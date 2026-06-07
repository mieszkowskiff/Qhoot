# analytics_worker/main.py
#
# Cloud Function (Gen2) triggered by Eventarc on Firestore document update.
# Fires for every /rooms/{roomId} update.
# Reads room status directly from Firestore instead of parsing Protobuf event data.

import os
import logging
from datetime import datetime, timezone

import functions_framework
from google.cloud import firestore, bigquery

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

PROJECT_ID = os.environ["GCP_PROJECT_ID"]
DB_NAME    = os.environ["FIRESTORE_DB_NAME"]
BQ_DATASET = os.environ["BQ_DATASET"]

def NOW() -> str:
    return datetime.now(timezone.utc).isoformat()

_fs_client = None
_bq_client = None

def fs() -> firestore.Client:
    global _fs_client
    if _fs_client is None:
        _fs_client = firestore.Client(project=PROJECT_ID, database=DB_NAME)
    return _fs_client

def bq() -> bigquery.Client:
    global _bq_client
    if _bq_client is None:
        _bq_client = bigquery.Client(project=PROJECT_ID)
    return _bq_client


@functions_framework.cloud_event
def process_room_completion(cloud_event):
    """
    Entry point — called by Eventarc on every /rooms/{roomId} update.
    Extracts room_id from event path, then reads status directly from Firestore.
    """
    print("=== ANALYTICS WORKER CALLED ===")

    # Wyciągnij room_id z document name w evencie
    # Eventarc zawsze dostarcza document path nawet gdy data jest Protobuf
    room_id = None
    try:
        data = cloud_event.data
        # Próbuj jako dict (JSON mode)
        if isinstance(data, dict):
            resource_name = data.get("value", {}).get("name", "") or data.get("name", "")
            room_id = resource_name.split("/")[-1] if resource_name else None
    except Exception as e:
        print(f"Could not parse event data as dict: {e}")

    # Fallback: wyciągnij z atrybutów CloudEvent
    if not room_id:
        try:
            doc_path = cloud_event.get("document", "") or cloud_event.get("subject", "")
            if doc_path:
                room_id = doc_path.split("/")[-1]
        except Exception as e:
            print(f"Could not get room_id from attributes: {e}")

    # Ostatni fallback: spróbuj z bytes
    if not room_id:
        try:
            raw = cloud_event.data
            if isinstance(raw, (bytes, bytearray)):
                text = raw.decode("utf-8", errors="ignore")
                # Szukaj patterns jak "rooms/XXXXX"
                import re
                match = re.search(r'rooms/([A-Za-z0-9]+)', text)
                if match:
                    room_id = match.group(1)
        except Exception as e:
            print(f"Could not extract room_id from bytes: {e}")

    print(f"Extracted room_id: {room_id}")

    if not room_id or room_id == "qhoot-database":
        print("Could not extract valid room_id, skipping.")
        return

    # Czytaj status bezpośrednio z Firestore zamiast z eventu
    room_ref = fs().collection("rooms").document(room_id)
    room_doc = room_ref.get()

    if not room_doc.exists:
        print(f"Room {room_id} not found in Firestore, skipping.")
        return

    room_data = room_doc.to_dict()
    status = room_data.get("status")
    print(f"Room {room_id} status: {status}")

    if status != "finished":
        print(f"Room {room_id} is not finished (status={status}), skipping.")
        return

    # Sprawdź czy już przetworzony (idempotency)
    if room_data.get("analyticsProcessed"):
        print(f"Room {room_id} already processed, skipping.")
        return

    print(f"Room {room_id} finished — starting analytics aggregation")

    try:
        _aggregate_and_stream(room_id, room_data)
        # Oznacz jako przetworzone żeby nie duplikować przy retry
        print(f"Analytics done for room: {room_id}")
    except Exception as exc:
        print(f"Analytics failed for room {room_id}: {exc}")
        raise


def _aggregate_and_stream(room_id: str, room_data: dict):
    inserted_at = NOW()
    room_ref = fs().collection("rooms").document(room_id)
    quiz_id = room_data.get("quizId")

    # ── Load players ──────────────────────────────────────────────────────────
    players = {
        doc.id: doc.to_dict()
        for doc in room_ref.collection("players").stream()
    }

    if not players:
        print(f"No players found for room {room_id}, skipping.")
        return

    print(f"Found {len(players)} players")

    # ── Load questions ────────────────────────────────────────────────────────
    questions = {}
    if quiz_id:
        questions = {
            doc.id: doc.to_dict()
            for doc in fs().collection("quizzes")
                           .document(quiz_id)
                           .collection("questions")
                           .order_by("order")
                           .stream()
        }
    print(f"Found {len(questions)} questions")

    # ── Per-question stats ────────────────────────────────────────────────────
    q_stats: dict[int, dict] = {}

    for player_data in players.values():
        answers = player_data.get("answers") or {}
        for key, ans in answers.items():
            if not isinstance(ans, dict):
                continue
            try:
                q_index = int(key[1:])
            except (ValueError, IndexError):
                continue
            if q_index not in q_stats:
                q_stats[q_index] = {"total": 0, "correct": 0}
            q_stats[q_index]["total"] += 1
            if ans.get("isCorrect"):
                q_stats[q_index]["correct"] += 1

    ordered_questions = sorted(questions.items(), key=lambda x: x[1].get("order", 0))

    question_rows = []
    for q_index, (q_id, q_data) in enumerate(ordered_questions):
        stat = q_stats.get(q_index, {"total": 0, "correct": 0})
        total = stat["total"]
        correct = stat["correct"]
        question_rows.append({
            "room_id":         room_id,
            "question_id":     q_id,
            "question_index":  q_index,
            "question_text":   q_data.get("text", ""),
            "total_answers":   total,
            "correct_answers": correct,
            "correct_rate":    round(correct / total, 4) if total > 0 else None,
            "inserted_at":     inserted_at,
        })

    # ── Per-player results ────────────────────────────────────────────────────
    player_rows = sorted(
        [
            {
                "room_id":       room_id,
                "player_id":     pid,
                "nickname":      p.get("nickname") or p.get("name"),
                "final_score":   p.get("score", 0),
                "correct_count": sum(
                    1 for ans in (p.get("answers") or {}).values()
                    if isinstance(ans, dict) and ans.get("isCorrect")
                ),
                "rank":          None,
                "inserted_at":   inserted_at,
            }
            for pid, p in players.items()
        ],
        key=lambda x: x["final_score"],
        reverse=True,
    )
    for rank, row in enumerate(player_rows, start=1):
        row["rank"] = rank

    # ── Quiz session aggregate ────────────────────────────────────────────────
    scores = [r["final_score"] for r in player_rows]
    session_row = {
        "room_id":        room_id,
        "quiz_id":        quiz_id,
        "player_count":   len(players),
        "question_count": len(questions),
        "avg_score":      round(sum(scores) / len(scores), 2) if scores else None,
        "max_score":      max(scores) if scores else None,
        "finished_at":    NOW(),
        "inserted_at":    inserted_at,
    }

    print(f"Inserting: session={session_row}, players={len(player_rows)}, questions={len(question_rows)}")

    # ── Stream to BigQuery ────────────────────────────────────────────────────
    _bq_insert(f"{BQ_DATASET}.quiz_sessions",  [session_row])
    _bq_insert(f"{BQ_DATASET}.player_results", player_rows)
    _bq_insert(f"{BQ_DATASET}.question_stats", question_rows)


def _bq_insert(table: str, rows: list[dict]):
    if not rows:
        print(f"No rows to insert for {table}")
        return
    errors = bq().insert_rows_json(table, rows)
    if errors:
        raise RuntimeError(f"BigQuery insert errors for {table}: {errors}")
    print(f"Inserted {len(rows)} rows into {table}")