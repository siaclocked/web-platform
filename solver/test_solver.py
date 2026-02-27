"""
Regression tests for solver v2 — flexible shift model.

T-F1: Cross-window shift
  A worker available 08:00-18:00 should get a single shift that satisfies
  both an 08:00-13:00 window AND a 13:00-18:00 window (not two separate
  assignments, since max 1 shift/day is enforced).

T-F2: Partial availability handoff
  Worker A available 09:00-13:30, Worker B available 13:30-16:00.
  A single 09:00-16:00 coverage window requiring 1 worker should produce
  two non-overlapping shifts that together cover the full window.

T-F3: Min-length fallback under understaffing
  Four workers each already have their best long shift assigned.  A small
  uncovered pocket of 2 h remains.  The solver must assign a
  min_hours_per_block-length shift (2 h) rather than leave it as a gap.

T-F4: Long-shift preference
  Two workers are both available for a full 08:00-18:00 day (1 window).
  With max_hours_per_block = 8 h the solver should assign shifts close
  to 8 h, not short ones.

T-F5: Max-1-shift-per-day preserved
  One worker is available across three consecutive coverage windows on the
  same day.  They must receive exactly one assignment.
"""

import pytest
from main import (
    SolveRequest, SolveResponse,
    Worker, CoverageWindow, Unavailability, PlaceSettings, SkillConstraint,
    _solve_greedy, ORTOOLS_AVAILABLE,
)

if ORTOOLS_AVAILABLE:
    from main import _solve_cpsat

# ── Helpers ───────────────────────────────────────────────────────────────────

BASE_DATE = "2025-01-06"   # Monday
END_1DAY  = "2025-01-06"
END_3DAY  = "2025-01-08"

SETTINGS_30 = PlaceSettings(
    max_hours_per_day=12,
    min_hours_per_block=2,
    max_hours_per_block=8,
    granularity_minutes=30,
)


def make_worker(wid: str, name: str, skill: str = "sk1",
                avail_start: int | None = None,
                avail_end:   int | None = None,
                rating: int = 5,
                can_open: bool = True,
                can_close: bool = True) -> tuple[Worker, list[Unavailability]]:
    """
    Returns (Worker, unavailability_list).
    avail_start/end are minutes from midnight defining the AVAILABLE window.
    Unavailability is created for the blocks OUTSIDE that window on day 0.
    """
    worker = Worker(
        id=wid, name=name, skill_ids=[skill], place_ids=["p1"],
        skill_ratings={skill: rating}, can_open=can_open, can_close=can_close
    )
    unavails: list[Unavailability] = []
    if avail_start is not None and avail_end is not None:
        if avail_start > 0:
            unavails.append(Unavailability(
                worker_id=wid, day=0,
                start_minutes=0, end_minutes=avail_start,
                is_full_day=False,
            ))
        if avail_end < 24 * 60:
            unavails.append(Unavailability(
                worker_id=wid, day=0,
                start_minutes=avail_end, end_minutes=24 * 60,
                is_full_day=False,
            ))
    return worker, unavails


def _solvers():
    """Parametrize over available solvers."""
    fns = [_solve_greedy]
    if ORTOOLS_AVAILABLE:
        fns.append(_solve_cpsat)
    return fns


# ── T-F1: Cross-window shift ──────────────────────────────────────────────────

@pytest.mark.parametrize("solver_fn", _solvers())
def test_cross_window_single_shift(solver_fn):
    """
    One worker, two adjacent windows (08:00-13:00 + 13:00-16:00), each needing
    1 worker.  Solver should assign exactly 1 shift spanning both windows (08:00-16:00)
    without assigning two separate shifts to the same worker on the same day.
    """
    worker, unavails = make_worker("w1", "Alice", avail_start=8*60, avail_end=16*60)

    request = SolveRequest(
        place_id="p1", start_date=BASE_DATE, end_date=END_1DAY,
        workers=[worker],
        coverage_windows=[
            CoverageWindow(id="cov-am", skill_id="sk1", day=0,
                           start_minutes=8*60, end_minutes=13*60, min_workers=1),
            CoverageWindow(id="cov-pm", skill_id="sk1", day=0,
                           start_minutes=13*60, end_minutes=16*60, min_workers=1),
        ],
        unavailability=unavails,
        settings=SETTINGS_30,  # max_hours_per_block=8 — windows total 8 h
        balance_hours=False, minimize_changes=False,
    )

    result: SolveResponse = solver_fn(request)

    # Must not be fully infeasible
    assert result.status in ("OPTIMAL", "FEASIBLE"), \
        f"Expected OPTIMAL/FEASIBLE, got {result.status}"

    worker_assignments = [a for a in result.assignments if a.worker_id == "w1"]

    # Hard constraint: at most one shift per worker per day
    assert len(worker_assignments) <= 1, \
        f"Worker received {len(worker_assignments)} shifts on same day — max-1 violated"

    # Coverage: both windows should be satisfied (no gaps)
    assert len(result.coverage_gaps) == 0, \
        f"Expected 0 coverage gaps, got: {result.coverage_gaps}"

    # The assigned shift should span across the boundary (start ≤ 13:00, end ≥ 13:00)
    if worker_assignments:
        a = worker_assignments[0]
        # Single shift must bridge the 13:00 boundary to cover both windows
        assert a.start_minutes <= 13 * 60, "Shift should start at or before 13:00"
        assert a.end_minutes >= 13 * 60, "Shift should end at or after 13:00"
        assert a.end_minutes <= 16 * 60, "Shift should end by 16:00 (worker availability)"


# ── T-F2: Partial availability handoff ───────────────────────────────────────

@pytest.mark.parametrize("solver_fn", _solvers())
def test_partial_availability_handoff(solver_fn):
    """
    Worker A available only 09:00-13:30, Worker B only 13:30-16:00.
    Single coverage window 09:00-16:00 requiring 1 worker.
    Solver should assign A for the morning portion and B for the afternoon,
    together covering the full window with no gap.
    """
    worker_a, unavail_a = make_worker("wa", "Alice", avail_start=9*60, avail_end=13*60+30)
    worker_b, unavail_b = make_worker("wb", "Bob",   avail_start=13*60+30, avail_end=16*60)

    request = SolveRequest(
        place_id="p1", start_date=BASE_DATE, end_date=END_1DAY,
        workers=[worker_a, worker_b],
        coverage_windows=[
            CoverageWindow(id="cov-full", skill_id="sk1", day=0,
                           start_minutes=9*60, end_minutes=16*60, min_workers=1),
        ],
        unavailability=unavail_a + unavail_b,
        settings=SETTINGS_30,
        balance_hours=False, minimize_changes=False,
    )

    result: SolveResponse = solver_fn(request)

    assert result.status in ("OPTIMAL", "FEASIBLE"), \
        f"Expected OPTIMAL/FEASIBLE, got {result.status}"

    # Both workers should be assigned (handoff scenario)
    assigned_ids = {a.worker_id for a in result.assignments}
    assert "wa" in assigned_ids, "Worker A (morning) should be assigned"
    assert "wb" in assigned_ids, "Worker B (afternoon) should be assigned"

    # No overlap between the two shifts
    a_shift = next(a for a in result.assignments if a.worker_id == "wa")
    b_shift = next(a for a in result.assignments if a.worker_id == "wb")
    assert a_shift.end_minutes <= b_shift.start_minutes, \
        f"Shifts overlap: A ends {a_shift.end_minutes}, B starts {b_shift.start_minutes}"

    # Together they should cover the full 09:00-16:00 window (no gaps)
    assert len(result.coverage_gaps) == 0, \
        f"Expected 0 gaps after handoff, got: {result.coverage_gaps}"


# ── T-F3: Min-length fallback under understaffing ─────────────────────────────

@pytest.mark.parametrize("solver_fn", _solvers())
def test_min_length_fallback_understaffing(solver_fn):
    """
    A 4-hour coverage window (12:00-16:00) requires 1 worker.
    Only one worker is available, and only for a 2-hour window (14:00-16:00),
    which is exactly min_hours_per_block.
    The solver should assign the 2-hour min-length shift to avoid leaving
    the window fully uncovered, even though it's a short shift.
    """
    # Worker only available 14:00-16:00 (exactly 2 h = min shift length)
    worker, unavails = make_worker("w1", "Alice", avail_start=14*60, avail_end=16*60)

    request = SolveRequest(
        place_id="p1", start_date=BASE_DATE, end_date=END_1DAY,
        workers=[worker],
        coverage_windows=[
            CoverageWindow(id="cov1", skill_id="sk1", day=0,
                           start_minutes=12*60, end_minutes=16*60, min_workers=1),
        ],
        unavailability=unavails,
        settings=SETTINGS_30,  # min_hours_per_block=2
        balance_hours=False, minimize_changes=False,
    )

    result: SolveResponse = solver_fn(request)

    # The solver should assign a shift (not give up entirely)
    assert len(result.assignments) == 1, \
        f"Expected 1 assignment (min-length fallback), got {len(result.assignments)}"

    a = result.assignments[0]
    shift_minutes = a.end_minutes - a.start_minutes

    # Shift length should be exactly min_hours_per_block (2 h = 120 min)
    assert shift_minutes >= 2 * 60, \
        f"Shift shorter than min_hours_per_block: {shift_minutes} min"

    # Shift must fit inside worker availability (14:00-16:00)
    assert a.start_minutes >= 14 * 60, f"Shift starts before availability: {a.start_minutes}"
    assert a.end_minutes   <= 16 * 60, f"Shift ends after availability: {a.end_minutes}"

    # Coverage gap should still exist for 12:00-14:00 (nobody available there)
    # but 14:00-16:00 portion should be covered
    covered_slots = set(range(a.start_minutes // 30, a.end_minutes // 30))
    demand_slots  = set(range(12 * 60 // 30, 16 * 60 // 30))
    assert covered_slots & demand_slots, "Assigned shift should overlap the demand window"


# ── T-F4: Long-shift preference ───────────────────────────────────────────────

@pytest.mark.parametrize("solver_fn", _solvers())
def test_long_shift_preference(solver_fn):
    """
    One worker available for a full 08:00-18:00 day, one 10-h coverage window.
    With max_hours_per_block=8h the solver should assign a shift close to 8 h,
    not a short one (demonstrating P3 objective).
    """
    worker, unavails = make_worker("w1", "Alice", avail_start=8*60, avail_end=18*60)

    request = SolveRequest(
        place_id="p1", start_date=BASE_DATE, end_date=END_1DAY,
        workers=[worker],
        coverage_windows=[
            CoverageWindow(id="cov1", skill_id="sk1", day=0,
                           start_minutes=8*60, end_minutes=18*60, min_workers=1),
        ],
        unavailability=unavails,
        settings=SETTINGS_30,  # max_hours_per_block=8
        balance_hours=False, minimize_changes=False,
    )

    result: SolveResponse = solver_fn(request)

    assert result.assignments, "Expected at least one assignment"
    a = result.assignments[0]
    shift_hours = (a.end_minutes - a.start_minutes) / 60

    # Should assign close to the max (8 h), definitely not a short shift
    assert shift_hours >= 6.0, \
        f"Solver preferred a short shift ({shift_hours:.1f}h) when a long one was possible"


# ── T-F5: Max-1-shift-per-day preserved ──────────────────────────────────────

@pytest.mark.parametrize("solver_fn", _solvers())
def test_max_one_shift_per_day(solver_fn):
    """
    One worker available all day, three consecutive coverage windows.
    Worker must receive at most 1 shift on that day.
    """
    worker, _ = make_worker("w1", "Alice")  # no unavailability = available all day

    request = SolveRequest(
        place_id="p1", start_date=BASE_DATE, end_date=END_1DAY,
        workers=[worker],
        coverage_windows=[
            CoverageWindow(id="c1", skill_id="sk1", day=0,
                           start_minutes=8*60,  end_minutes=12*60, min_workers=1),
            CoverageWindow(id="c2", skill_id="sk1", day=0,
                           start_minutes=12*60, end_minutes=16*60, min_workers=1),
            CoverageWindow(id="c3", skill_id="sk1", day=0,
                           start_minutes=16*60, end_minutes=20*60, min_workers=1),
        ],
        unavailability=[],
        settings=SETTINGS_30,
        balance_hours=False, minimize_changes=False,
    )

    result: SolveResponse = solver_fn(request)

    worker_day_shifts = [a for a in result.assignments if a.worker_id == "w1" and a.day == 0]
    assert len(worker_day_shifts) <= 1, \
        f"Max-1-shift-per-day violated: worker got {len(worker_day_shifts)} shifts"


@pytest.mark.parametrize("solver_fn", _solvers())
def test_rating_constraint_single_worker_threshold(solver_fn):
    """When min average is enforced, a single low-rated worker must not be assigned."""
    worker, unavails = make_worker("w1", "Low", rating=6, avail_start=9 * 60, avail_end=13 * 60)

    request = SolveRequest(
        place_id="p1", start_date=BASE_DATE, end_date=END_1DAY,
        workers=[worker],
        coverage_windows=[
            CoverageWindow(id="cov", skill_id="sk1", day=0, start_minutes=9 * 60, end_minutes=13 * 60, min_workers=1),
        ],
        skill_constraints=[
            SkillConstraint(skill_id="sk1", enforce_min_team_rating=True, min_avg_rating=7.0),
        ],
        unavailability=unavails,
        settings=SETTINGS_30,
        balance_hours=False, minimize_changes=False,
    )

    result: SolveResponse = solver_fn(request)
    assert all(a.worker_id != "w1" for a in result.assignments), "Low-rated single worker should not be scheduled"
    assert result.coverage_gaps, "Coverage gap expected because only ineligible worker is available"


@pytest.mark.parametrize("solver_fn", _solvers())
def test_rating_constraint_multi_worker_average(solver_fn):
    """Parallel workers can satisfy min average as a group (e.g., 6 + 8 >= avg 7)."""
    low, ua_low = make_worker("w1", "Low", rating=6, avail_start=9 * 60, avail_end=13 * 60)
    high, ua_high = make_worker("w2", "High", rating=8, avail_start=9 * 60, avail_end=13 * 60)

    request = SolveRequest(
        place_id="p1", start_date=BASE_DATE, end_date=END_1DAY,
        workers=[low, high],
        coverage_windows=[
            CoverageWindow(id="cov", skill_id="sk1", day=0, start_minutes=9 * 60, end_minutes=13 * 60, min_workers=2),
        ],
        skill_constraints=[
            SkillConstraint(skill_id="sk1", enforce_min_team_rating=True, min_avg_rating=7.0),
        ],
        unavailability=ua_low + ua_high,
        settings=SETTINGS_30,
        balance_hours=False, minimize_changes=False,
    )

    result: SolveResponse = solver_fn(request)
    assigned = {a.worker_id for a in result.assignments}
    assert "w1" in assigned and "w2" in assigned, "Both workers should be assigned to satisfy avg rating and coverage"
    assert len(result.coverage_gaps) == 0, f"Expected full coverage, got gaps: {result.coverage_gaps}"


@pytest.mark.parametrize("solver_fn", _solvers())
def test_rating_constraint_disabled_allows_low_rating(solver_fn):
    """If enforcement is disabled, low-rated worker assignment is allowed."""
    worker, unavails = make_worker("w1", "Low", rating=4, avail_start=9 * 60, avail_end=13 * 60)

    request = SolveRequest(
        place_id="p1", start_date=BASE_DATE, end_date=END_1DAY,
        workers=[worker],
        coverage_windows=[
            CoverageWindow(id="cov", skill_id="sk1", day=0, start_minutes=9 * 60, end_minutes=13 * 60, min_workers=1),
        ],
        skill_constraints=[
            SkillConstraint(skill_id="sk1", enforce_min_team_rating=False, min_avg_rating=7.0),
        ],
        unavailability=unavails,
        settings=SETTINGS_30,
        balance_hours=False, minimize_changes=False,
    )

    result: SolveResponse = solver_fn(request)
    assert any(a.worker_id == "w1" for a in result.assignments), "Worker should be assignable when rating rule is disabled"


def test_locked_low_rating_under_enforcement_is_infeasible():
    """A locked shift below min average must make the model infeasible if no compensating worker exists."""
    if not ORTOOLS_AVAILABLE:
        pytest.skip("Locked-assignment infeasibility check requires CP-SAT path")

    worker, unavails = make_worker("w1", "Low", rating=6, avail_start=9 * 60, avail_end=13 * 60)

    request = SolveRequest(
        place_id="p1", start_date=BASE_DATE, end_date=END_1DAY,
        workers=[worker],
        coverage_windows=[
            CoverageWindow(id="cov", skill_id="sk1", day=0, start_minutes=9 * 60, end_minutes=13 * 60, min_workers=1),
        ],
        existing_assignments=[
            {
                "worker_id": "w1",
                "skill_id": "sk1",
                "day": 0,
                "start_minutes": 9 * 60,
                "end_minutes": 13 * 60,
                "is_locked": True,
            }
        ],
        skill_constraints=[
            SkillConstraint(skill_id="sk1", enforce_min_team_rating=True, min_avg_rating=7.0),
        ],
        unavailability=unavails,
        settings=SETTINGS_30,
        balance_hours=False, minimize_changes=False,
    )

    result: SolveResponse = _solve_cpsat(request)
    assert result.status == "INFEASIBLE", "Locked low-rating shift should be infeasible under enforced threshold"


@pytest.mark.parametrize("solver_fn", _solvers())
def test_can_open_required_for_single_worker_day(solver_fn):
    """Single worker without can_open must not be scheduled as day opener."""
    worker, unavails = make_worker("w1", "Alice", avail_start=9 * 60, avail_end=13 * 60, can_open=False, can_close=True)

    request = SolveRequest(
        place_id="p1", start_date=BASE_DATE, end_date=END_1DAY,
        workers=[worker],
        coverage_windows=[
            CoverageWindow(id="cov", skill_id="sk1", day=0, start_minutes=9 * 60, end_minutes=13 * 60, min_workers=1),
        ],
        unavailability=unavails,
        settings=SETTINGS_30,
        balance_hours=False, minimize_changes=False,
    )

    result: SolveResponse = solver_fn(request)
    assert all(a.worker_id != "w1" for a in result.assignments), "Worker without can_open must not be scheduled first"


@pytest.mark.parametrize("solver_fn", _solvers())
def test_can_close_required_for_single_worker_day(solver_fn):
    """Single worker without can_close must not be scheduled as day closer."""
    worker, unavails = make_worker("w1", "Alice", avail_start=9 * 60, avail_end=13 * 60, can_open=True, can_close=False)

    request = SolveRequest(
        place_id="p1", start_date=BASE_DATE, end_date=END_1DAY,
        workers=[worker],
        coverage_windows=[
            CoverageWindow(id="cov", skill_id="sk1", day=0, start_minutes=9 * 60, end_minutes=13 * 60, min_workers=1),
        ],
        unavailability=unavails,
        settings=SETTINGS_30,
        balance_hours=False, minimize_changes=False,
    )

    result: SolveResponse = solver_fn(request)
    assert all(a.worker_id != "w1" for a in result.assignments), "Worker without can_close must not be scheduled last"
