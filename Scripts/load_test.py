"""
load_test.py — symulator Thundering Herd dla Qhoot
====================================================
Wysyła N głosów jednocześnie do API Gateway i mierzy czasy odpowiedzi.

Użycie:
    pip install aiohttp
    python load_test.py

Konfiguracja poniżej — zmień ROOM_ID, QUESTION_INDEX itp.
"""

import asyncio
import sys
import aiohttp
import time
import random
import string
from dataclasses import dataclass

# ── Konfiguracja ──────────────────────────────────────────────────────────────
# https://qhoot-api-gateway-221815489759.europe-central2.run.app
API_URL = "https://qhoot-api-gateway-221815489759.europe-central2.run.app"
# Zamień na URL twojego Cloud Run z apiGateway — znajdziesz go w GCP Console
# → Cloud Run → qhoot-api-gateway → URL na górze strony
# Powinien wyglądać tak:
# API_URL = "https://qhoot-api-gateway-xxxx-ew.a.run.app"

ROOM_ID         = "GYZC2M"   # ← zmień na aktywny room_id
QUESTION_INDEX  = 0           # ← numer pytania (0-based)
NUM_PLAYERS     = 200          # ← ilu graczy głosuje jednocześnie
NUM_ANSWERS     = 4           # ← ile opcji odpowiedzi ma pytanie

# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class Result:
    player_id: str
    status: int
    latency_ms: float
    error: str = None


def random_player_id(length=8) -> str:
    return "test_" + "".join(random.choices(string.ascii_letters + string.digits, k=length))


async def send_vote(session: aiohttp.ClientSession, player_id: str) -> Result:
    payload = {
        "roomId":        ROOM_ID,
        "playerId":      player_id,
        "questionIndex": QUESTION_INDEX,
        "answerIndex":   random.randint(0, NUM_ANSWERS - 1),
    }

    start = time.perf_counter()
    try:
        async with session.post(
            f"{API_URL}/api/v1/vote",
            json=payload,
            timeout=aiohttp.ClientTimeout(total=10),
        ) as resp:
            latency = (time.perf_counter() - start) * 1000
            return Result(
                player_id=player_id,
                status=resp.status,
                latency_ms=round(latency, 1),
            )
    except Exception as e:
        latency = (time.perf_counter() - start) * 1000
        return Result(
            player_id=player_id,
            status=0,
            latency_ms=round(latency, 1),
            error=str(e),
        )


async def run_load_test():
    player_ids = [random_player_id() for _ in range(NUM_PLAYERS)]

    print(f"\n{'='*55}")
    print(f"  Qhoot Thundering Herd Test")
    print(f"{'='*55}")
    print(f"  Room:     {ROOM_ID}")
    print(f"  Question: {QUESTION_INDEX}")
    print(f"  Players:  {NUM_PLAYERS} (wszystkie naraz)")
    print(f"  Endpoint: {API_URL}/api/v1/vote")
    print(f"{'='*55}\n")

    print(f"Wysyłam {NUM_PLAYERS} głosów jednocześnie...")
    start_total = time.perf_counter()

    async with aiohttp.ClientSession() as session:
        tasks = [send_vote(session, pid) for pid in player_ids]
        results = await asyncio.gather(*tasks)

    total_time = (time.perf_counter() - start_total) * 1000

    # ── Statystyki ────────────────────────────────────────────────────────────
    successes  = [r for r in results if r.status == 202]
    failures   = [r for r in results if r.status != 202]
    latencies  = [r.latency_ms for r in results]

    print(f"\n{'='*55}")
    print(f"  Wyniki")
    print(f"{'='*55}")
    print(f"  Wysłano:        {NUM_PLAYERS}")
    print(f"  Sukces (202):   {len(successes)}")
    print(f"  Błędy:          {len(failures)}")
    print(f"  Czas całkowity: {round(total_time, 1)} ms")
    print(f"\n  Latencje (ms):")
    print(f"    min:    {min(latencies):.1f}")
    print(f"    median: {sorted(latencies)[len(latencies)//2]:.1f}")
    print(f"    max:    {max(latencies):.1f}")
    print(f"    avg:    {sum(latencies)/len(latencies):.1f}")

    if failures:
        print(f"\n  Błędy ({len(failures)}):")
        for r in failures[:5]:  # pokaż max 5
            print(f"    [{r.status}] {r.player_id}: {r.error or 'non-202'}")

    print(f"{'='*55}\n")

    # ── SLO check (z dokumentu projektowego) ─────────────────────────────────
    median = sorted(latencies)[len(latencies)//2]
    max_lat = max(latencies)
    slo_median = median < 2500
    slo_max    = max_lat < 5000

    print(f"  SLO check (POST /vote):")
    print(f"    median < 2500ms:  {'✅ PASS' if slo_median else '❌ FAIL'} ({median:.1f}ms)")
    print(f"    max < 5000ms:    {'✅ PASS' if slo_max else '❌ FAIL'} ({max_lat:.1f}ms)")
    print(f"    availability:    {'✅ PASS' if len(successes)/NUM_PLAYERS >= 0.99 else '❌ FAIL'} ({len(successes)/NUM_PLAYERS*100:.1f}%)")
    print(f"{'='*55}\n")


if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        
    asyncio.run(run_load_test())