"""
Regression test for the `max_workers` cap on CoverageWindow.

Scenario:
  - 1 day, Bar skill, open 15:00-20:00 (5h window).
  - Demand: min_workers=1, max_workers=1 → exactly 1 worker must cover the slot.
  - 3 workers all available → without the cap the solver would happily
    schedule multiple to hit hour targets.

Expected: at most 1 Bar shift per slot. Total assigned worker-slots = exactly
the 5h window (10 slots at 30-min granularity).
"""

import sys
from pathlib import Path
from datetime import date
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from main import (
    CoverageWindow, SolveRequest, Worker, PlaceSettings,
    _solve_cpsat, _solve_greedy, _build_slot_cap,
)


def _make_request(max_workers_value: int | None, balance_hours: bool = True) -> SolveRequest:
    # Monthly hour targets are intentionally omitted — they interact with
    # horizon length in ways irrelevant to the cap test.
    workers = [
        Worker(
            id=f"w{i}", name=f"Worker {i}",
            skill_ids=["Bar"], place_ids=["p1"],
            skill_ratings={"Bar": 8},
        )
        for i in range(3)
    ]
    coverage = [
        CoverageWindow(
            id="c1", skill_id="Bar", day=0,
            start_minutes=15 * 60, end_minutes=20 * 60,
            min_workers=1, max_workers=max_workers_value,
        )
    ]
    return SolveRequest(
        place_id="p1",
        start_date=date(2026, 1, 1).isoformat(),
        end_date=date(2026, 1, 1).isoformat(),
        workers=workers,
        coverage_windows=coverage,
        settings=PlaceSettings(
            min_shift_minutes=120, max_shift_minutes=360,
            granularity_minutes=30,
        ),
        balance_hours=balance_hours,
        minimize_changes=False,
        solver_timeout_seconds=10,
    )


def test_build_slot_cap_basic():
    """Slot cap is a sum across overlapping windows, uncapped if any window lacks a cap."""
    cov = [
        CoverageWindow(id="a", skill_id="Bar", day=0,
                       start_minutes=15*60, end_minutes=20*60,
                       min_workers=1, max_workers=1),
        CoverageWindow(id="b", skill_id="Bar", day=0,
                       start_minutes=18*60, end_minutes=19*60,
                       min_workers=1, max_workers=1),
    ]
    caps = _build_slot_cap(cov, granularity=30)
    # Slots 15:00-18:00 covered only by window a → cap=1
    # Slots 18:00-19:00 covered by a+b → cap=2
    # Slots 19:00-20:00 covered only by a → cap=1
    assert caps[(0, "Bar", 30)] == 1        # 15:00
    assert caps[(0, "Bar", 36)] == 2        # 18:00
    assert caps[(0, "Bar", 38)] == 1        # 19:00


def test_build_slot_cap_uncapped_window_wins():
    """If any covering window has max_workers=None, the slot is uncapped."""
    cov = [
        CoverageWindow(id="a", skill_id="Bar", day=0,
                       start_minutes=15*60, end_minutes=20*60,
                       min_workers=1, max_workers=1),
        CoverageWindow(id="b", skill_id="Bar", day=0,
                       start_minutes=18*60, end_minutes=19*60,
                       min_workers=1, max_workers=None),   # no cap
    ]
    caps = _build_slot_cap(cov, granularity=30)
    # 15:00 slot capped at 1 (only window a)
    assert caps[(0, "Bar", 30)] == 1
    # 18:00 slot should be uncapped (absent)
    assert (0, "Bar", 36) not in caps


def test_cpsat_respects_max_workers():
    req = _make_request(max_workers_value=1)
    resp = _solve_cpsat(req)
    assert resp.status in ("OPTIMAL", "FEASIBLE")
    # With max_workers=1, at most 1 worker may cover any given slot.
    from collections import Counter
    slot_count: Counter = Counter()
    for a in resp.assignments:
        for slot in range(a.start_minutes // 30, a.end_minutes // 30):
            slot_count[(a.day, a.skill_id, slot)] += 1
    assert all(v <= 1 for v in slot_count.values()), \
        f"cap violated: {slot_count}"
    # Coverage should still be satisfied (no gaps).
    assert resp.coverage_gaps == []


def test_cpsat_without_cap_may_overstaff():
    """Sanity check: with no cap, the solver is free to overstaff."""
    req = _make_request(max_workers_value=None)
    resp = _solve_cpsat(req)
    # This test just asserts it solves; it doesn't enforce overstaffing.
    assert resp.status in ("OPTIMAL", "FEASIBLE")


def test_greedy_respects_max_workers():
    req = _make_request(max_workers_value=1)
    resp = _solve_greedy(req)
    assert resp.status in ("OPTIMAL", "FEASIBLE")
    from collections import Counter
    slot_count: Counter = Counter()
    for a in resp.assignments:
        for slot in range(a.start_minutes // 30, a.end_minutes // 30):
            slot_count[(a.day, a.skill_id, slot)] += 1
    assert all(v <= 1 for v in slot_count.values()), \
        f"cap violated: {slot_count}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
