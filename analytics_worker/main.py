# analytics_worker/main.py
#
# Cloud Function (Gen2) triggered by Eventarc on Firestore document update.
# Fires for every /quizzes/{quizId} update — exits early if status != "finished".
# On quiz completion: reads all subcollections from Firestore,
# aggregates stats, and streams rows to BigQuery (visible in ~seconds).

import os
import json
import logging
from datetime import datetime, timezone

import functions_framework
from google.cloud import firestore, bigquery

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

PROJECT_ID    = os.environ["GCP_PROJECT_ID"]
DB_NAME       = os.environ["FIRESTORE_DB_NAME"]
BQ_DATASET    = os.environ["BQ_DATASET"]
NOW           = lambda: datetime.now(timezone.utc).isoformat()

_fs_client = None
_bq_client = None

def fs():
    global _fs_client
    if _fs_client is None:
        _fs_client = firestore.Client(project=PROJECT_ID, database=DB_NAME)
    return _fs_client

def bq():
    global _bq_client
    if _bq_client is None:
        _bq_client = bigquery.Client(project=PROJECT_ID)
    return _bq_client


@functions_framework.cloud_event
def process_quiz_completion(cloud_event):
    """
    Entry point — called by Eventarc on every /quizzes/{quizId} update.
    Exits immediately unless quiz.status just changed to 'finished'.
    """
    data = cloud_event.data

    # Eventarc Firestore events carry old/new field values
    new_fields = data.get("value", {}).get("fields", {})
    old_fields = data.get("oldValue", {}).get("fields", {})

    new_status = _str_field(new_fields, "status")
    old_status = _str_field(old_fields, "status")

    # Only process the exact moment quiz transitions to "finished"
    if new_status != "finished" or old_status == "finished":
        log.info("Skipping update — status: %s → %s", old_status, new_status)
        return

    # Extract quizId from the Firestore document path
    # Path format: projects/{proj}/databases/{db}/documents/quizzes/{quizId}
    resource_name = data.get("value", {}).get("name", "")
    quiz_id = resource_name.split("/")[-1]

    log.info("Quiz finished: %s — starting analytics aggregation", quiz_id)

    try:
        _aggregate_and_stream(quiz_id, new_fields)
        log.info("Analytics done for quiz: %s", quiz_id)
    except Exception as exc:
        log.exception("Analytics failed for quiz %s: %s", quiz_id, exc)
        raise  # re-raise so Eventarc retries


def _aggregate_and_stream(quiz_id: str, quiz_fields: dict):
    inserted_at = NOW()
    quiz_ref = fs().collection("quizzes").document(quiz_id)

    # ── Load players ─────────────────────────────────────────────────────────
    players = {
        doc.id: doc.to_dict()
        for doc in quiz_ref.collection("players").stream()
    }

    # ── Load questions ────────────────────────────────────────────────────────
    questions = {
        doc.id: doc.to_dict()
        for doc in quiz_ref.collection("questions").stream()
    }

    # ── Load answers ──────────────────────────────────────────────────────────
    answers = [doc.to_dict() for doc in quiz_ref.collection("answers").stream()]

    # ── Compute per-question stats ────────────────────────────────────────────
    q_stats: dict[str, dict] = {qid: {"total": 0, "correct": 0, "total_ms": 0} for qid in questions}

    for ans in answers:
        qid = ans.get("questionId")
        if qid not in q_stats:
            continue
        q_stats[qid]["total"]    += 1
        q_stats[qid]["correct"]  += 1 if ans.get("isCorrect") else 0
        q_stats[qid]["total_ms"] += ans.get("responseTimeMs", 0)

    question_rows = []
    for qid, q in questions.items():
        stat = q_stats.get(qid, {})
        total = stat.get("total", 0)
        correct = stat.get("correct", 0)
        question_rows.append({
            "quiz_id":         quiz_id,
            "question_id":     qid,
            "question_text":   q.get("text", ""),
            "question_order":  q.get("order"),
            "total_answers":   total,
            "correct_answers": correct,
            "correct_rate":    round(correct / total, 4) if total > 0 else None,
            "avg_response_ms": (stat["total_ms"] // total) if total > 0 else None,
            "inserted_at":     inserted_at,
        })

    # ── Compute per-player results with ranking ───────────────────────────────
    player_scores = sorted(
        [
            {
                "quiz_id":       quiz_id,
                "player_id":     pid,
                "nickname":      p.get("nickname"),
                "total_score":   p.get("totalScore", 0),
                "correct_count": sum(
                    1 for a in answers
                    if a.get("playerId") == pid and a.get("isCorrect")
                ),
                "joined_at":     _ts_field(p, "joinedAt"),
                "inserted_at":   inserted_at,
            }
            for pid, p in players.items()
        ],
        key=lambda x: x["total_score"],
        reverse=True,
    )
    for rank, row in enumerate(player_scores, start=1):
        row["rank"] = rank

    # ── Compute quiz session aggregate ────────────────────────────────────────
    scores = [r["total_score"] for r in player_scores]
    session_row = {
        "quiz_id":        quiz_id,
        "title":          _str_field(quiz_fields, "title"),
        "host_id":        _str_field(quiz_fields, "hostId"),
        "player_count":   len(players),
        "question_count": len(questions),
        "avg_score":      round(sum(scores) / len(scores), 2) if scores else None,
        "max_score":      max(scores) if scores else None,
        "created_at":     _str_field(quiz_fields, "createdAt"),
        "finished_at":    _str_field(quiz_fields, "finishedAt"),
        "inserted_at":    inserted_at,
    }

    # ── Stream all rows to BigQuery ───────────────────────────────────────────
    # insert_rows_json uses the BigQuery Storage Write API streaming path —
    # data is available for querying within seconds of insertion.
    _bq_insert(f"{BQ_DATASET}.quiz_sessions",   [session_row])
    _bq_insert(f"{BQ_DATASET}.question_stats",  question_rows)
    _bq_insert(f"{BQ_DATASET}.player_results",  player_scores)


def _bq_insert(table: str, rows: list[dict]):
    if not rows:
        return
    errors = bq().insert_rows_json(table, rows)
    if errors:
        raise RuntimeError(f"BigQuery insert errors for {table}: {errors}")
    log.info("Inserted %d rows into %s", len(rows), table)


# ── Firestore field value helpers ─────────────────────────────────────────────
# Eventarc sends Firestore field values as typed wrappers, e.g.:
#   { "stringValue": "finished" }  or  { "timestampValue": "2025-04-01T..." }

def _str_field(fields: dict, key: str) -> str | None:
    return fields.get(key, {}).get("stringValue")

def _ts_field(doc: dict, key: str) -> str | None:
    val = doc.get(key)
    if val is None:
        return None
    # Firestore SDK returns datetime objects
    if hasattr(val, "isoformat"):
        return val.isoformat()
    return str(val)
