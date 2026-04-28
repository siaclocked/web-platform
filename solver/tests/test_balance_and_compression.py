"""
Regression tests for the soft objectives that shape "shape of work":

  (a)  Peer hour balance      — same-skill workers land within a few hours of each other.
  (a2) Peer working-day balance — and within a similar number of *days*.
  (b)  Day-off-gap minimization — fewer disjoint working blocks per worker.
  (c)  Excess-consecutive cap   — runs of >3 work-days-in-a-row are penalized.

Priority order (encoded by weights):  peer balance ≫ gap count ≫ optimal-hour pull.
The "peer-balance-beats-gap" test below pins this priority down.

Each test uses a tiny single-skill scenario where the desired behavior is
unambiguous, so weight tuning isn't load-bearing.
"""

import sys
from pathlib import Path
from datetime import date
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from main import (
    CoverageWindow, SolveRequest, Worker, PlaceSettings,
    _solve_cpsat,
)


def _coverage_for_days(num_days, start_min=15 * 60, end_min=22 * 60):
    """One waiter window per day, 7h, capped at 1 worker."""
    return [
        CoverageWindow(
            id=f"c{d}", skill_id="Waiter", day=d,
            start_minutes=start_min, end_minutes=end_min,
            min_workers=1, max_workers=1,
        )
        for d in range(num_days)
    ]


def _make_request(workers, num_days):
    return SolveRequest(
        place_id="p1",
        start_date=date(2026, 1, 5).isoformat(),     # Mon, full week ahead
        end_date=(date(2026, 1, 5) + __import__("datetime").timedelta(days=num_days - 1)).isoformat(),
        workers=workers,
        coverage_windows=_coverage_for_days(num_days),
        settings=PlaceSettings(
            min_shift_minutes=180, max_shift_minutes=600,
            granularity_minutes=30,
        ),
        balance_hours=True,
        minimize_changes=False,
        solver_timeout_seconds=15,
    )


# ────────────────────────────────────────────────────────────────────────────
# (a) Peer hour balance
# ────────────────────────────────────────────────────────────────────────────

def test_peer_balance_splits_hours_evenly():
    """Two equally-available workers covering 7 days × 7h should land
    around half each, not 49h vs 0h."""
    workers = [
        Worker(id="w1", name="A", skill_ids=["Waiter"], place_ids=["p1"],
               skill_ratings={"Waiter": 8}),
        Worker(id="w2", name="B", skill_ids=["Waiter"], place_ids=["p1"],
               skill_ratings={"Waiter": 8}),
    ]
    resp = _solve_cpsat(_make_request(workers, num_days=7))
    assert resp.status in ("OPTIMAL", "FEASIBLE")
    hours = resp.total_hours_by_worker
    spread = max(hours.values()) - min(hours.values())
    # 49 total worker-hours / 2 = 24.5h each. Spread should be tiny.
    assert spread <= 7.0, f"hours unbalanced: {hours} (spread {spread}h)"


# ────────────────────────────────────────────────────────────────────────────
# (b) Block compression
# ────────────────────────────────────────────────────────────────────────────

def _count_blocks(day_indices_worked):
    """Number of contiguous work-day runs."""
    if not day_indices_worked:
        return 0
    days = sorted(set(day_indices_worked))
    blocks = 1
    for prev, cur in zip(days, days[1:]):
        if cur != prev + 1:
            blocks += 1
    return blocks


def test_block_compression_clusters_days():
    """A worker with 4 work-days out of 7 should land in ≤2 blocks
    (ideally 1: 4 in a row), never scattered to 3+ — i.e. ≤1 day-off gap."""
    workers = [
        Worker(id="w1", name="A", skill_ids=["Waiter"], place_ids=["p1"],
               skill_ratings={"Waiter": 8}),
        Worker(id="w2", name="B", skill_ids=["Waiter"], place_ids=["p1"],
               skill_ratings={"Waiter": 8}),
    ]
    resp = _solve_cpsat(_make_request(workers, num_days=7))
    assert resp.status in ("OPTIMAL", "FEASIBLE")

    by_worker_days: dict[str, list[int]] = {}
    for a in resp.assignments:
        by_worker_days.setdefault(a.worker_id, []).append(a.day)

    for wid, days in by_worker_days.items():
        blocks = _count_blocks(days)
        assert blocks <= 2, f"worker {wid} has {blocks} blocks: {sorted(days)}"


def test_peer_balance_beats_gap_penalty():
    """Peer balance is the *primary* fairness lever — it must out-rank the
    gap-count penalty.  Setup: 5 days of demand, 2 fully-available workers.
    The balanced split (3+2 days, identical hours per shift) means w1 ends
    up with a 1-day gap (3 days, off, 1 day) — and that's *fine*. The
    solver must NOT bunch all 5 days onto a single worker just to keep one
    block per worker."""
    workers = [
        Worker(id="w1", name="A", skill_ids=["Waiter"], place_ids=["p1"],
               skill_ratings={"Waiter": 8}),
        Worker(id="w2", name="B", skill_ids=["Waiter"], place_ids=["p1"],
               skill_ratings={"Waiter": 8}),
    ]
    resp = _solve_cpsat(_make_request(workers, num_days=5))
    assert resp.status in ("OPTIMAL", "FEASIBLE")
    hours = resp.total_hours_by_worker
    spread = max(hours.values()) - min(hours.values())
    # 5 × 7h = 35h split between two workers ⇒ ideal ≤ 7h spread.
    assert spread <= 7.0, f"hour spread too high: {hours}"
    # Both workers must be used (otherwise gap-count penalty has trivially
    # outranked peer balance, which is the bug we're guarding against).
    assigned_workers = {a.worker_id for a in resp.assignments}
    assert assigned_workers == {"w1", "w2"}, (
        f"both workers must share the load, got {assigned_workers}"
    )


# ────────────────────────────────────────────────────────────────────────────
# (c) Soft cap on >3 consecutive days
# ────────────────────────────────────────────────────────────────────────────

def _longest_run(day_indices_worked):
    if not day_indices_worked:
        return 0
    days = sorted(set(day_indices_worked))
    longest = current = 1
    for prev, cur in zip(days, days[1:]):
        if cur == prev + 1:
            current += 1
            longest = max(longest, current)
        else:
            current = 1
    return longest


def test_consecutive_run_softcap_when_alternative_exists():
    """With 3 fully-available workers covering 7 days, no one should be
    forced into a 4+ day run."""
    workers = [
        Worker(id="w1", name="A", skill_ids=["Waiter"], place_ids=["p1"],
               skill_ratings={"Waiter": 8}),
        Worker(id="w2", name="B", skill_ids=["Waiter"], place_ids=["p1"],
               skill_ratings={"Waiter": 8}),
        Worker(id="w3", name="C", skill_ids=["Waiter"], place_ids=["p1"],
               skill_ratings={"Waiter": 8}),
    ]
    resp = _solve_cpsat(_make_request(workers, num_days=7))
    assert resp.status in ("OPTIMAL", "FEASIBLE")

    by_worker_days: dict[str, list[int]] = {}
    for a in resp.assignments:
        by_worker_days.setdefault(a.worker_id, []).append(a.day)

    for wid, days in by_worker_days.items():
        run = _longest_run(days)
        assert run <= 3, f"worker {wid} runs {run} days in a row: {sorted(days)}"


def test_consecutive_run_relaxes_when_unavoidable():
    """With only ONE worker covering 5 days, we have no choice — soft cap
    must yield rather than break feasibility."""
    workers = [
        Worker(id="solo", name="Solo", skill_ids=["Waiter"], place_ids=["p1"],
               skill_ratings={"Waiter": 8}),
    ]
    resp = _solve_cpsat(_make_request(workers, num_days=5))
    assert resp.status in ("OPTIMAL", "FEASIBLE")
    assert resp.coverage_gaps == [], "coverage must still be filled"
    days = sorted({a.day for a in resp.assignments})
    assert days == [0, 1, 2, 3, 4], f"solo worker must cover all days, got {days}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
