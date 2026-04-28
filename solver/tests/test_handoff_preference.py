"""
Regression test for the "handoff preference" soft objective.

Scenario (mirrors the Ziedonis Tue/Wed pattern):
  - 1 day, Waiter skill, cafe open 15:00-22:00.
  - Coverage: baseline 15-22 (min=1, max=1) + peak 18-21 (min=1, max=1).
      => 1 worker 15-18, 2 workers 18-21, 1 worker 21-22.
  - 2 workers fully available.

Without the handoff preference the solver is free to pick either:
  (a) opener 15-22 (7h) + peak helper 18-21 (3h)  ← "nested", worker leaves while other stays
  (b) opener 15-21 (6h) + closer 18-22 (4h)       ← handoff, no nesting

Both use 10 worker-hours total and satisfy all coverage. The new objective
should consistently push the solver toward (b).
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


def _shifts_by_worker(resp):
    return {
        a.worker_id: (a.start_minutes, a.end_minutes)
        for a in resp.assignments
    }


def _make_request():
    workers = [
        Worker(id="w_open",  name="Opener",  skill_ids=["Waiter"], place_ids=["p1"],
               skill_ratings={"Waiter": 8}),
        Worker(id="w_close", name="Closer",  skill_ids=["Waiter"], place_ids=["p1"],
               skill_ratings={"Waiter": 8}),
    ]
    coverage = [
        CoverageWindow(id="baseline", skill_id="Waiter", day=0,
                       start_minutes=15 * 60, end_minutes=22 * 60,
                       min_workers=1, max_workers=1),
        CoverageWindow(id="peak",     skill_id="Waiter", day=0,
                       start_minutes=18 * 60, end_minutes=21 * 60,
                       min_workers=1, max_workers=1),
    ]
    return SolveRequest(
        place_id="p1",
        start_date=date(2026, 1, 1).isoformat(),
        end_date=date(2026, 1, 1).isoformat(),
        workers=workers,
        coverage_windows=coverage,
        settings=PlaceSettings(
            min_shift_minutes=180, max_shift_minutes=600,
            granularity_minutes=30,
        ),
        balance_hours=True,
        minimize_changes=False,
        solver_timeout_seconds=10,
    )


def test_handoff_preference_eliminates_nesting():
    """No shift should be strictly nested inside another on the same day/skill."""
    resp = _solve_cpsat(_make_request())
    assert resp.status in ("OPTIMAL", "FEASIBLE")
    assert resp.coverage_gaps == []

    by_skill_day = [(a.start_minutes, a.end_minutes) for a in resp.assignments]
    for i, (s_a, e_a) in enumerate(by_skill_day):
        for s_b, e_b in by_skill_day[i + 1:]:
            nested = (s_a < s_b and e_a > e_b) or (s_b < s_a and e_b > e_a)
            assert not nested, (
                f"nested shift pair found: ({s_a}, {e_a}) contains ({s_b}, {e_b})"
            )


def test_handoff_produces_opener_and_closer():
    """Confirm the specific (15-21 + 18-22) handoff shape."""
    resp = _solve_cpsat(_make_request())
    spans = sorted([(a.start_minutes, a.end_minutes) for a in resp.assignments])
    # Expect two shifts: one starting at 15:00 and one starting at 18:00.
    starts = sorted(s for s, _ in spans)
    ends = sorted(e for _, e in spans)
    assert starts == [15 * 60, 18 * 60], f"unexpected starts {starts}"
    # Later arrival should not close before the earlier one.
    # i.e. the 15:00 shift's end <= the 18:00 shift's end.
    by_start = {s: e for s, e in spans}
    assert by_start[15 * 60] <= by_start[18 * 60], \
        f"FIFO violation in output: opener ends at {by_start[15*60]}, closer ends at {by_start[18*60]}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
