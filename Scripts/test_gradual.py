"""
load_test.py — Thundering Herd simulator for Qhoot
====================================================
Simulates a realistic quiz session:
  1. Creates N fake players in Firestore while room is in "waiting" state
  2. Waits for host to start the quiz (status -> "question")
  3. For each question: sends all votes simultaneously, then waits for next question
  4. Reports latency stats and SLO results per question

Usage:
    pip install aiohttp
    py -3.11 load_test.py

Edit the CONFIGURATION section before running.
Steps:
    1. Create a room in the host frontend
    2. Set ROOM_ID below and run this script
    3. You will see players appear in the lobby
    4. Click "Start Quiz" in the host frontend
    5. The script will automatically vote on each question
    6. Click "Next Question" in the host frontend to advance
"""

from __future__ import annotations
import asyncio
import sys
import aiohttp
import time
import random
from datetime import datetime, timezone

# ── Configuration ─────────────────────────────────────────────────────────────

API_GATEWAY_URL     = "https://qhoot-api-gateway-221815489759.europe-central2.run.app"
FIREBASE_PROJECT_ID = "ahds-adhs-ajds-sjhd-djsh"
FIREBASE_API_KEY    = "YOUR_FIREBASE_API_KEY"   # VITE_FIREBASE_API_KEY from .env.local

ROOM_ID     = "R353XD"   # create a fresh room in host frontend first
NUM_PLAYERS = 10          # number of simultaneous players to simulate
NUM_ANSWERS = 4           # number of answer options per question

# How often to poll Firestore for room state changes (seconds)
POLL_INTERVAL = 2.0

NICKNAMES = [
    "C'estlavie", "Bob", "Helloworld", "IamLegend", "Eve", "Frank", "Grace", "Hank",
    "Iris", "Jack", "Karen", "Leo", "Mia", "Nick", "Olivia", "Pete",
    "Quinn", "Rose", "Sam", "Tina", "Uma", "Victor", "Wendy", "Xander",
    "Yara", "Zoe", "Aaron", "Bella", "Carl", "Daisy", "Eli", "Fiona",
    "George", "Holly", "Ivan", "Julia", "Kevin", "Luna", "Marco", "Nina",
]

# ── Firestore REST helpers ────────────────────────────────────────────────────

FIRESTORE_BASE = (
    f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}"
    f"/databases/qhoot-database/documents"
)


def firestore_value(val):
    if isinstance(val, str):
        return {"stringValue": val}
    if isinstance(val, int):
        return {"integerValue": str(val)}
    if isinstance(val, float):
        return {"doubleValue": val}
    if isinstance(val, bool):
        return {"booleanValue": val}
    raise TypeError(f"Unsupported type: {type(val)}")


async def get_room(session: aiohttp.ClientSession) -> dict | None:
    """Fetch current room document from Firestore REST API."""
    url = f"{FIRESTORE_BASE}/rooms/{ROOM_ID}?key={FIREBASE_API_KEY}"
    try:
        async with session.get(url) as resp:
            if resp.status == 200:
                data = await resp.json()
                fields = data.get("fields", {})
                return {
                    "status":               fields.get("status", {}).get("stringValue"),
                    "currentQuestionIndex": int(fields.get("currentQuestionIndex", {}).get("integerValue", 0)),
                }
    except Exception as e:
        print(f"Error fetching room: {e}")
    return None


async def create_player(session: aiohttp.ClientSession, nickname: str) -> str | None:
    """Create a player document in Firestore, matching Join.jsx addDoc() logic."""
    url = f"{FIRESTORE_BASE}/rooms/{ROOM_ID}/players?key={FIREBASE_API_KEY}"
    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    body = {
        "fields": {
            "nickname": firestore_value(nickname),
            "score":    firestore_value(0),
            "joinedAt": {"timestampValue": now_iso},
        }
    }

    try:
        async with session.post(url, json=body) as resp:
            if resp.status == 200:
                data = await resp.json()
                return data["name"].split("/")[-1]
            else:
                text = await resp.text()
                print(f"Failed to create player {nickname}: {resp.status} {text[:80]}")
                return None
    except Exception as e:
        print(f"Error creating player {nickname}: {e}")
        return None


async def send_vote(
    session: aiohttp.ClientSession,
    player_id: str,
    nickname: str,
    question_index: int,
) -> dict:
    payload = {
        "roomId":        ROOM_ID,
        "playerId":      player_id,
        "questionIndex": question_index,
        "answerIndex":   random.randint(0, NUM_ANSWERS - 1),
    }

    start = time.perf_counter()
    try:
        async with session.post(
            f"{API_GATEWAY_URL}/api/v1/vote",
            json=payload,
            timeout=aiohttp.ClientTimeout(total=10),
        ) as resp:
            latency = (time.perf_counter() - start) * 1000
            return {"nickname": nickname, "status": resp.status, "latency_ms": round(latency, 1)}
    except Exception as e:
        latency = (time.perf_counter() - start) * 1000
        return {"nickname": nickname, "status": 0, "latency_ms": round(latency, 1), "error": str(e)}


def print_question_stats(question_index: int, results: list[dict]):
    successes = [r for r in results if r["status"] == 202]
    failures  = [r for r in results if r["status"] != 202]
    latencies = sorted([r["latency_ms"] for r in results])

    print(f"\n  Question {question_index} results:")
    print(f"    Success (202): {len(successes)}/{len(results)}")
    if latencies:
        print(f"    p50: {latencies[len(latencies)//2]:.1f}ms  "
              f"p95: {latencies[int(len(latencies)*0.95)]:.1f}ms  "
              f"max: {max(latencies):.1f}ms")
    if failures:
        for r in failures[:3]:
            print(f"    ERROR [{r['status']}] {r['nickname']}: {r.get('error', 'non-202')}")


# ── Main ──────────────────────────────────────────────────────────────────────

async def run_load_test():
    nicknames = (NICKNAMES * ((NUM_PLAYERS // len(NICKNAMES)) + 1))[:NUM_PLAYERS]

    print(f"\n{'='*55}")
    print(f"  Qhoot Thundering Herd Test — Realistic Mode")
    print(f"{'='*55}")
    print(f"  Room:     {ROOM_ID}")
    print(f"  Players:  {NUM_PLAYERS}")
    print(f"{'='*55}\n")

    all_results = []

    async with aiohttp.ClientSession() as session:

        # ── Step 1: Create players while room is waiting ──────────────────────
        print("Step 1: Creating players in Firestore...")
        print("        (room must be in 'waiting' state)\n")

        room = await get_room(session)
        if not room:
            print("ERROR: Could not fetch room. Check ROOM_ID and FIREBASE_API_KEY.")
            return
        if room["status"] == "finished":
            print("ERROR: Room is already finished. Create a new room.")
            return

        create_tasks = [create_player(session, nick) for nick in nicknames]
        player_ids = await asyncio.gather(*create_tasks)

        valid = [(pid, nick) for pid, nick in zip(player_ids, nicknames) if pid]
        print(f"  Created {len(valid)}/{NUM_PLAYERS} players.")

        if not valid:
            print("  No players created — aborting.")
            return

        # ── Step 2: Wait for host to start the quiz ───────────────────────────
        print(f"\nStep 2: Waiting for host to click 'Start Quiz'...")
        print(f"        Open the host frontend and start the quiz now.\n")

        while True:
            room = await get_room(session)
            if room and room["status"] == "question":
                print(f"  Quiz started! Current question: {room['currentQuestionIndex']}")
                break
            if room and room["status"] == "finished":
                print("  Room finished before quiz started. Aborting.")
                return
            await asyncio.sleep(POLL_INTERVAL)

        # ── Step 3: Vote on each question ─────────────────────────────────────
        last_question_index = -1

        print(f"\nStep 3: Voting on each question...")
        print(f"        Click 'Next Question' in host frontend to advance.\n")

        while True:
            room = await get_room(session)
            if not room:
                await asyncio.sleep(POLL_INTERVAL)
                continue

            if room["status"] == "finished":
                print("\n  Quiz finished by host.")
                break

            current_q = room["currentQuestionIndex"]

            # New question detected — send all votes simultaneously
            if current_q != last_question_index:
                last_question_index = current_q
                print(f"  Question {current_q} detected — sending {len(valid)} votes simultaneously...")

                start = time.perf_counter()
                vote_tasks = [send_vote(session, pid, nick, current_q) for pid, nick in valid]
                results = await asyncio.gather(*vote_tasks)
                elapsed = (time.perf_counter() - start) * 1000

                all_results.extend(results)
                print_question_stats(current_q, results)
                print(f"    All votes sent in {elapsed:.1f}ms")
                print(f"    Waiting for next question (click 'Next Question' in host)...")

            await asyncio.sleep(POLL_INTERVAL)

    # ── Final SLO report ──────────────────────────────────────────────────────
    if not all_results:
        print("\nNo results collected.")
        return

    all_latencies = sorted([r["latency_ms"] for r in all_results])
    all_successes = [r for r in all_results if r["status"] == 202]
    availability  = len(all_successes) / len(all_results)
    median        = all_latencies[len(all_latencies)//2]
    max_lat       = max(all_latencies)

    print(f"\n{'='*55}")
    print(f"  Final SLO Report — POST /vote")
    print(f"{'='*55}")
    print(f"  Total votes sent:  {len(all_results)}")
    print(f"  Success (202):     {len(all_successes)}")
    print(f"  p50 latency:       {median:.1f}ms")
    print(f"  p95 latency:       {all_latencies[int(len(all_latencies)*0.95)]:.1f}ms")
    print(f"  max latency:       {max_lat:.1f}ms")
    print(f"\n  p50 < 3000ms:    {'PASS' if median < 3000 else 'FAIL'} ({median:.1f}ms)")
    print(f"  p95 < 7000ms:      {'PASS' if all_latencies[int(len(all_latencies)*0.95)] < 7000 else 'FAIL'} ({all_latencies[int(len(all_latencies)*0.95)]:.1f}ms)")
    print(f"  availability ≥99%: {'PASS' if availability >= 0.99 else 'FAIL'} ({availability*100:.1f}%)")
    print(f"{'='*55}\n")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(run_load_test())