"""
load_test.py — Thundering Herd simulator for Qhoot
====================================================
Simulates a full quiz session:
  1. Creates N fake players in Firestore (matching Join.jsx logic)
  2. Sends all their votes simultaneously to the API Gateway
  3. Reports latency stats and SLO results

Usage:
    pip install aiohttp
    python load_test.py

Edit the CONFIGURATION section before running.
"""

import asyncio
import sys
import aiohttp
import time
import random
import string
from datetime import datetime, timezone

# ── Configuration ─────────────────────────────────────────────────────────────

API_GATEWAY_URL = "https://qhoot-api-gateway-221815489759.europe-central2.run.app"
# Firebase project config — copy from frontend/.env.local
FIREBASE_PROJECT_ID = "ahds-adhs-ajds-sjhd-djsh"
FIREBASE_API_KEY    = "YOUR_FIREBASE_API_KEY"   # VITE_FIREBASE_API_KEY from .env.local

ROOM_ID        = "X34FUB"  # create a fresh room in the host frontend first
QUESTION_INDEX = 1          # question number to vote on (0-based)
NUM_PLAYERS    = 100        # number of simultaneous players to simulate
NUM_ANSWERS    = 4          # number of answer options for this question

NICKNAMES = [
    "JestemFajny", "Funny67", "HelloWorld", "WillYouMarryMe", "Eve", "Frank", "Grace", "Hank",
    "Iris", "Jack", "Karen", "Leo", "Mia", "Nick", "Olivia", "Pete",
    "HIhi", "Rose", "Sam", "C'estlavie", "Uma", "Victor", "Wendy", "Xander",
    "George", "Holly", "Ivan", "Julia", "Kevin", "Luna", "Marco", "Nina",
    "Oscar", "Paula", "Remy", "Sara", "Tom", "Xena", "Yoda",
]

# ── Firestore REST helpers ────────────────────────────────────────────────────
# We use the Firestore REST API to create players directly,
# exactly like Join.jsx does via the Firebase JS SDK.

FIRESTORE_BASE = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/qhoot-database/documents"

def firestore_value(val):
    """Convert a Python value to a Firestore REST API value wrapper."""
    if isinstance(val, str):
        return {"stringValue": val}
    if isinstance(val, int):
        return {"integerValue": str(val)}
    if isinstance(val, float):
        return {"doubleValue": val}
    if isinstance(val, bool):
        return {"booleanValue": val}
    raise TypeError(f"Unsupported type: {type(val)}")


async def create_player(session: aiohttp.ClientSession, nickname: str) -> str | None:
    """
    Creates a player document in rooms/{ROOM_ID}/players (POST = auto-generated ID).
    Returns the generated player_id or None on failure.
    Mirrors the addDoc() call in Join.jsx.
    """
    url = f"{FIRESTORE_BASE}/rooms/{ROOM_ID}/players?key={FIREBASE_API_KEY}"
    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    body = {
        "fields": {
            "nickname":  firestore_value(nickname),
            "score":     firestore_value(0),
            "joinedAt":  {"timestampValue": now_iso},
        }
    }

    try:
        async with session.post(url, json=body) as resp:
            if resp.status == 200:
                data = await resp.json()
                # document name format: .../documents/rooms/ROOM/players/PLAYER_ID
                player_id = data["name"].split("/")[-1]
                return player_id
            else:
                text = await resp.text()
                print(f"Failed to create player {nickname}: {resp.status} {text[:100]}")
                return None
    except Exception as e:
        print(f"Error creating player {nickname}: {e}")
        return None


# ── Vote sender ───────────────────────────────────────────────────────────────

async def send_vote(
    session: aiohttp.ClientSession,
    player_id: str,
    nickname: str,
) -> dict:
    payload = {
        "roomId":        ROOM_ID,
        "playerId":      player_id,
        "questionIndex": QUESTION_INDEX,
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


# ── Main ──────────────────────────────────────────────────────────────────────

async def run_load_test():
    nicknames = (NICKNAMES * ((NUM_PLAYERS // len(NICKNAMES)) + 1))[:NUM_PLAYERS]
    # Make each nickname unique by appending a number if needed
    nicknames = [f"{n}{i}" if nicknames.count(n) > 1 else n for i, n in enumerate(nicknames)]

    print(f"\n{'='*55}")
    print(f"  Qhoot Thundering Herd Test")
    print(f"{'='*55}")
    print(f"  Room:        {ROOM_ID}")
    print(f"  Question:    {QUESTION_INDEX}")
    print(f"  Players:     {NUM_PLAYERS}")
    print(f"  API Gateway: {API_GATEWAY_URL}")
    print(f"{'='*55}\n")

    async with aiohttp.ClientSession() as session:

        # ── Step 1: Create players in Firestore ───────────────────────────────
        print(f"Step 1: Creating {NUM_PLAYERS} players in Firestore...")
        create_tasks = [create_player(session, nick) for nick in nicknames]
        player_ids = await asyncio.gather(*create_tasks)

        valid = [(pid, nick) for pid, nick in zip(player_ids, nicknames) if pid]
        failed_creates = NUM_PLAYERS - len(valid)

        print(f"  Created: {len(valid)}/{NUM_PLAYERS} players")
        if failed_creates:
            print(f"  WARNING: {failed_creates} players failed to create")
        if not valid:
            print("  No players created — check FIREBASE_API_KEY and ROOM_ID. Aborting.")
            return

        # Small pause to let Firestore settle before votes arrive
        await asyncio.sleep(0.5)

        # ── Step 2: Send all votes simultaneously ─────────────────────────────
        print(f"\nStep 2: Sending {len(valid)} votes simultaneously...")
        start_total = time.perf_counter()

        vote_tasks = [send_vote(session, pid, nick) for pid, nick in valid]
        results = await asyncio.gather(*vote_tasks)

        total_time = (time.perf_counter() - start_total) * 1000

    # ── Results ───────────────────────────────────────────────────────────────
    successes = [r for r in results if r["status"] == 202]
    failures  = [r for r in results if r["status"] != 202]
    latencies = [r["latency_ms"] for r in results]
    sorted_lat = sorted(latencies)

    print(f"\n{'='*55}")
    print(f"  Results")
    print(f"{'='*55}")
    print(f"  Sent:          {len(results)}")
    print(f"  Success (202): {len(successes)}")
    print(f"  Errors:        {len(failures)}")
    print(f"  Total time:    {round(total_time, 1)} ms")
    print(f"\n  Latencies (ms):")
    print(f"    min:    {min(latencies):.1f}")
    print(f"    p50:    {sorted_lat[len(sorted_lat)//2]:.1f}")
    print(f"    p95:    {sorted_lat[int(len(sorted_lat)*0.95)]:.1f}")
    print(f"    max:    {max(latencies):.1f}")
    print(f"    avg:    {sum(latencies)/len(latencies):.1f}")

    if failures:
        print(f"\n  Errors (first 5):")
        for r in failures[:5]:
            print(f"    [{r['status']}] {r['nickname']}: {r.get('error', 'non-202')}")

    # ── SLO check ─────────────────────────────────────────────────────────────
    median = sorted_lat[len(sorted_lat)//2]
    max_lat = max(latencies)
    availability = len(successes) / len(results)

    print(f"\n{'='*55}")
    print(f"  SLO check — POST /vote (from project doc)")
    print(f"{'='*55}")
    print(f"  median < 500ms:   {'PASS' if median < 500 else 'FAIL'} ({median:.1f}ms)")
    print(f"  max < 1000ms:     {'PASS' if max_lat < 1000 else 'FAIL'} ({max_lat:.1f}ms)")
    print(f"  availability ≥99%: {'PASS' if availability >= 0.99 else 'FAIL'} ({availability*100:.1f}%)")
    print(f"{'='*55}\n")

    print("Done! Check the host frontend — all players should now appear")
    print("in the leaderboard after they vote.")
    print(f"Players created in: rooms/{ROOM_ID}/players\n")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(run_load_test())
