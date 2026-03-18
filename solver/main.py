"""
Clocked Schedule Solver Service — v2 (Flexible Shift Model)

Coverage windows define slot-level staffing demand only; a single worker
shift may span across multiple windows and extend around them so long as the
shift still overlaps demanded time and respects worker/place constraints.
"""

from __future__ import annotations

import asyncio
import json
import os
import queue as queue_module
import threading
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

ORTOOLS_AVAILABLE = False
try:
    from ortools.sat.python import cp_model

    ORTOOLS_AVAILABLE = True
    print("[solver-v2] OR-Tools loaded — using CP-SAT solver")
except (ImportError, OSError) as e:
    print(f"[solver-v2] OR-Tools unavailable ({e}) — using greedy fallback")


def _make_progress_callback_class():
    """Build the progress callback class, inheriting from CpSolverSolutionCallback when available."""
    base = cp_model.CpSolverSolutionCallback if ORTOOLS_AVAILABLE else object

    class _Cb(base):
        def __init__(self, progress_queue: queue_module.Queue | None = None):
            super().__init__()
            self._solution_count = 0
            self._queue = progress_queue

        def on_solution_callback(self):
            self._solution_count += 1
            if self._queue is not None:
                obj = self.ObjectiveValue()
                bound = self.BestObjectiveBound()
                gap = abs(obj - bound) / max(1, abs(obj)) * 100 if obj != 0 else 0
                self._queue.put({
                    "type": "progress",
                    "solutions_found": self._solution_count,
                    "objective": int(obj),
                    "bound": int(bound),
                    "wall_time_s": round(self.WallTime(), 1),
                    "gap_pct": round(gap, 1),
                })

        @property
        def solution_count(self) -> int:
            return self._solution_count

    return _Cb


_SolveProgressCallback = _make_progress_callback_class()


app = FastAPI(title="Clocked Solver v2", version="2.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Worker(BaseModel):
    id: str
    name: str
    skill_ids: list[str]
    place_ids: list[str]
    skill_ratings: dict[str, int] = {}
    start_date: Optional[str] = None
    status: Optional[str] = "ACTIVE"
    can_open: bool = True
    can_close: bool = True
    monthly_min_hours: float | None = None
    monthly_optimal_hours: float | None = None


class CoverageWindow(BaseModel):
    id: str
    skill_id: str
    day: int
    start_minutes: int
    end_minutes: int
    min_workers: int = 1


class ExistingAssignment(BaseModel):
    worker_id: str
    skill_id: str
    day: int
    start_minutes: int
    end_minutes: int
    is_locked: bool = False


class Unavailability(BaseModel):
    worker_id: str
    day: int
    start_minutes: Optional[int] = None
    end_minutes: Optional[int] = None
    is_full_day: bool = True


class PlaceSettings(BaseModel):
    max_hours_per_day: float = 12.0
    min_shift_minutes: int | None = None
    max_shift_minutes: int | None = None
    min_hours_per_block: float | None = 2.0
    max_hours_per_block: float | None = 12.0
    soft_min_shift_minutes: int | None = None
    soft_max_shift_minutes: int | None = None
    soft_min_hours_per_block: float | None = None
    soft_max_hours_per_block: float | None = None
    min_rest_between_shifts: float = 8.0
    granularity_minutes: int = 15

    def resolved_min_shift_minutes(self) -> int:
        if self.min_shift_minutes is not None:
            return int(self.min_shift_minutes)
        return int((self.min_hours_per_block or 2.0) * 60)

    def resolved_max_shift_minutes(self) -> int:
        if self.max_shift_minutes is not None:
            return int(self.max_shift_minutes)
        return int((self.max_hours_per_block or 12.0) * 60)

    def resolved_soft_min_shift_minutes(self) -> int | None:
        if self.soft_min_shift_minutes is not None:
            return int(self.soft_min_shift_minutes)
        if self.soft_min_hours_per_block is not None:
            return int(self.soft_min_hours_per_block * 60)
        return None

    def resolved_soft_max_shift_minutes(self) -> int | None:
        if self.soft_max_shift_minutes is not None:
            return int(self.soft_max_shift_minutes)
        if self.soft_max_hours_per_block is not None:
            return int(self.soft_max_hours_per_block * 60)
        return None


class SkillConstraint(BaseModel):
    skill_id: str
    enforce_min_team_rating: bool = False
    min_avg_rating: float | None = None


class WorkerMonthContext(BaseModel):
    worker_id: str
    month_start: str
    worked_hours: float = 0.0
    scheduled_hours_outside_interval: float = 0.0


class SolveRequest(BaseModel):
    place_id: str
    start_date: str
    end_date: str
    workers: list[Worker]
    coverage_windows: list[CoverageWindow]
    existing_assignments: list[ExistingAssignment] = []
    unavailability: list[Unavailability] = []
    skill_constraints: list[SkillConstraint] = []
    worker_month_context: list[WorkerMonthContext] = []
    settings: PlaceSettings = PlaceSettings()
    minimize_changes: bool = True
    balance_hours: bool = True
    solver_timeout_seconds: float = 60.0


class Assignment(BaseModel):
    worker_id: str
    worker_name: str
    skill_id: str
    day: int
    start_minutes: int
    end_minutes: int
    is_locked: bool = False


class CoverageGap(BaseModel):
    skill_id: str
    day: int
    start_minutes: int
    end_minutes: int
    required: int
    assigned: int


class ConstraintViolation(BaseModel):
    code: str
    message: str
    worker_id: str | None = None
    skill_id: str | None = None
    day: int | None = None
    start_minutes: int | None = None
    end_minutes: int | None = None


class SolveResponse(BaseModel):
    status: str
    assignments: list[Assignment]
    coverage_gaps: list[CoverageGap]
    diagnostics: list[str]
    constraint_violations: list[ConstraintViolation]
    solve_time_ms: int
    total_hours_by_worker: dict[str, float]


class ValidationResponse(BaseModel):
    status: str
    is_valid: bool
    assignments: list[Assignment]
    coverage_gaps: list[CoverageGap]
    diagnostics: list[str]
    constraint_violations: list[ConstraintViolation]
    total_hours_by_worker: dict[str, float]


def _parse_day_dates(request: SolveRequest) -> list[date]:
    start = datetime.fromisoformat(request.start_date).date()
    end = datetime.fromisoformat(request.end_date).date()
    num_days = (end - start).days + 1
    if num_days <= 0 or num_days > 31:
        raise HTTPException(status_code=400, detail="Invalid date range (1-31 days)")
    return [start + timedelta(days=offset) for offset in range(num_days)]


def _month_start_for_date(day_date: date) -> str:
    return day_date.replace(day=1).isoformat()


def _build_worker_month_baseline(request: SolveRequest, granularity: int) -> dict[tuple[str, str], int]:
    baseline: dict[tuple[str, str], int] = {}
    for entry in request.worker_month_context:
        hours = float(entry.worked_hours) + float(entry.scheduled_hours_outside_interval)
        baseline[(entry.worker_id, entry.month_start)] = int(round(hours * 60 / granularity))
    return baseline


def _settings_slots(settings: PlaceSettings) -> dict[str, int]:
    granularity = int(settings.granularity_minutes)
    min_shift_minutes = settings.resolved_min_shift_minutes()
    max_shift_minutes = settings.resolved_max_shift_minutes()
    soft_min_minutes = settings.resolved_soft_min_shift_minutes()
    soft_max_minutes = settings.resolved_soft_max_shift_minutes()

    min_slots = max(1, min_shift_minutes // granularity)
    max_slots = max(min_slots, max_shift_minutes // granularity)
    daily_max_slots = max(1, int((settings.max_hours_per_day * 60) // granularity))
    max_slots = min(max_slots, daily_max_slots)
    soft_min_slots = max(min_slots, (soft_min_minutes // granularity) if soft_min_minutes is not None else min_slots)
    soft_max_slots = max(min_slots, (soft_max_minutes // granularity) if soft_max_minutes is not None else max_slots)
    rest_slots = max(0, int((settings.min_rest_between_shifts * 60) // granularity))

    return {
        "granularity": granularity,
        "min_slots": min_slots,
        "max_slots": max_slots,
        "soft_min_slots": soft_min_slots,
        "soft_max_slots": soft_max_slots,
        "daily_max_slots": daily_max_slots,
        "rest_slots": rest_slots,
        "slots_per_day": 24 * 60 // granularity,
    }


def _is_shift_available(worker_id: str, day: int, start_min: int, end_min: int, unavail_lookup: dict) -> bool:
    for ua in unavail_lookup.get((worker_id, day), []):
        if ua.is_full_day:
            return False
        if ua.start_minutes is not None and ua.end_minutes is not None:
            if not (end_min <= ua.start_minutes or start_min >= ua.end_minutes):
                return False
    return True


def _build_unavailability_lookup(unavailability: list[Unavailability]) -> dict[tuple[str, int], list[Unavailability]]:
    lookup: dict[tuple[str, int], list[Unavailability]] = {}
    for ua in unavailability:
        lookup.setdefault((ua.worker_id, ua.day), []).append(ua)
    return lookup


def _build_demand(coverage_windows: list[CoverageWindow], granularity: int):
    demand: dict[tuple[int, str, int], int] = {}
    extent: dict[tuple[int, str], tuple[int, int]] = {}
    for cov in coverage_windows:
        start_slot = cov.start_minutes // granularity
        end_slot = cov.end_minutes // granularity
        key = (cov.day, cov.skill_id)
        current = extent.get(key)
        extent[key] = (min(current[0], start_slot), max(current[1], end_slot)) if current else (start_slot, end_slot)
        for slot in range(start_slot, end_slot):
            demand[(cov.day, cov.skill_id, slot)] = demand.get((cov.day, cov.skill_id, slot), 0) + cov.min_workers
    return demand, extent


def _build_coverage_boundaries(
    coverage_windows: list[CoverageWindow], granularity: int, max_slots: int | None = None,
) -> dict[tuple[int, str], list[int]]:
    boundaries: dict[tuple[int, str], set[int]] = {}
    for cov in coverage_windows:
        key = (cov.day, cov.skill_id)
        if key not in boundaries:
            boundaries[key] = set()
        boundaries[key].add(cov.start_minutes // granularity)
        boundaries[key].add(cov.end_minutes // granularity)
    if max_slots is not None:
        for key, slots in boundaries.items():
            extent_start = min(slots)
            extent_end = max(slots)
            derived: set[int] = set()
            for s in slots:
                ds = s - max_slots
                if extent_start <= ds < extent_end and ds not in slots:
                    derived.add(ds)
                de = s + max_slots
                if extent_start < de <= extent_end and de not in slots:
                    derived.add(de)
            slots.update(derived)
    return {key: sorted(slots) for key, slots in boundaries.items()}


def _build_skill_thresholds(skill_constraints: list[SkillConstraint]) -> dict[str, int]:
    thresholds: dict[str, int] = {}
    for constraint in skill_constraints:
        if constraint.enforce_min_team_rating and constraint.min_avg_rating is not None:
            thresholds[constraint.skill_id] = int(round(float(constraint.min_avg_rating) * 100))
    return thresholds


def _worker_is_eligible(worker: Worker, request: SolveRequest, skill_id: str, day_date: date) -> bool:
    if worker.status and worker.status != "ACTIVE":
        return False
    if skill_id not in worker.skill_ids:
        return False
    if request.place_id not in worker.place_ids and "ALL" not in worker.place_ids:
        return False
    if worker.start_date:
        start_date = datetime.fromisoformat(worker.start_date).date()
        if day_date < start_date:
            return False
    return True


def _assignment_to_response(assignment: ExistingAssignment | Assignment, workers_by_id: dict[str, Worker]) -> Assignment:
    worker = workers_by_id.get(assignment.worker_id)
    worker_name = worker.name if worker else assignment.worker_id
    return Assignment(
        worker_id=assignment.worker_id,
        worker_name=worker_name,
        skill_id=assignment.skill_id,
        day=assignment.day,
        start_minutes=assignment.start_minutes,
        end_minutes=assignment.end_minutes,
        is_locked=getattr(assignment, "is_locked", False),
    )


def _basic_assignment_violations(
    request: SolveRequest,
    assignments: list[ExistingAssignment | Assignment],
    workers_by_id: dict[str, Worker],
    unavail_lookup: dict,
    day_dates: list[date],
    slot_settings: dict[str, int],
) -> list[ConstraintViolation]:
    violations: list[ConstraintViolation] = []
    min_minutes = slot_settings["min_slots"] * slot_settings["granularity"]
    max_minutes = slot_settings["max_slots"] * slot_settings["granularity"]
    daily_max_minutes = slot_settings["daily_max_slots"] * slot_settings["granularity"]

    for assignment in assignments:
        worker = workers_by_id.get(assignment.worker_id)
        if worker is None:
            violations.append(
                ConstraintViolation(
                    code="UNKNOWN_WORKER",
                    message=f"Unknown worker {assignment.worker_id}",
                    worker_id=assignment.worker_id,
                    day=assignment.day,
                    start_minutes=assignment.start_minutes,
                    end_minutes=assignment.end_minutes,
                )
            )
            continue
        if assignment.day < 0 or assignment.day >= len(day_dates):
            violations.append(
                ConstraintViolation(
                    code="DAY_OUT_OF_RANGE",
                    message="Assignment day is outside the solve interval",
                    worker_id=assignment.worker_id,
                    skill_id=assignment.skill_id,
                    day=assignment.day,
                    start_minutes=assignment.start_minutes,
                    end_minutes=assignment.end_minutes,
                )
            )
            continue
        day_date = day_dates[assignment.day]
        if not _worker_is_eligible(worker, request, assignment.skill_id, day_date):
            violations.append(
                ConstraintViolation(
                    code="INELIGIBLE_WORKER",
                    message="Worker is not eligible for this place/skill/date",
                    worker_id=assignment.worker_id,
                    skill_id=assignment.skill_id,
                    day=assignment.day,
                    start_minutes=assignment.start_minutes,
                    end_minutes=assignment.end_minutes,
                )
            )
        duration = assignment.end_minutes - assignment.start_minutes
        if duration < min_minutes or duration > max_minutes:
            violations.append(
                ConstraintViolation(
                    code="SHIFT_DURATION",
                    message="Shift duration violates shift length bounds",
                    worker_id=assignment.worker_id,
                    skill_id=assignment.skill_id,
                    day=assignment.day,
                    start_minutes=assignment.start_minutes,
                    end_minutes=assignment.end_minutes,
                )
            )
        if duration > daily_max_minutes:
            violations.append(
                ConstraintViolation(
                    code="DAILY_MAX_HOURS",
                    message="Shift exceeds the configured daily maximum hours",
                    worker_id=assignment.worker_id,
                    skill_id=assignment.skill_id,
                    day=assignment.day,
                    start_minutes=assignment.start_minutes,
                    end_minutes=assignment.end_minutes,
                )
            )
        if assignment.start_minutes < 0 or assignment.end_minutes > 24 * 60 or assignment.start_minutes >= assignment.end_minutes:
            violations.append(
                ConstraintViolation(
                    code="INVALID_TIME_RANGE",
                    message="Assignment time range is invalid",
                    worker_id=assignment.worker_id,
                    skill_id=assignment.skill_id,
                    day=assignment.day,
                    start_minutes=assignment.start_minutes,
                    end_minutes=assignment.end_minutes,
                )
            )
            continue
        if not _is_shift_available(assignment.worker_id, assignment.day, assignment.start_minutes, assignment.end_minutes, unavail_lookup):
            violations.append(
                ConstraintViolation(
                    code="UNAVAILABLE",
                    message="Shift overlaps worker unavailability",
                    worker_id=assignment.worker_id,
                    skill_id=assignment.skill_id,
                    day=assignment.day,
                    start_minutes=assignment.start_minutes,
                    end_minutes=assignment.end_minutes,
                )
            )

    return violations


def _coverage_gaps(
    coverage_windows: list[CoverageWindow],
    assignments: list[Assignment],
    remaining_demand: dict[tuple[int, str, int], int],
    granularity: int,
) -> list[CoverageGap]:
    gaps: list[CoverageGap] = []
    for cov in coverage_windows:
        start_slot = cov.start_minutes // granularity
        end_slot = cov.end_minutes // granularity
        gap_start = None
        for slot in range(start_slot, end_slot + 1):
            has_gap = slot < end_slot and remaining_demand.get((cov.day, cov.skill_id, slot), 0) > 0
            if has_gap and gap_start is None:
                gap_start = slot
            elif not has_gap and gap_start is not None:
                gap_start_minutes = gap_start * granularity
                gap_end_minutes = slot * granularity
                assigned = sum(
                    1
                    for assignment in assignments
                    if assignment.day == cov.day
                    and assignment.skill_id == cov.skill_id
                    and assignment.start_minutes < gap_end_minutes
                    and assignment.end_minutes > gap_start_minutes
                )
                gaps.append(
                    CoverageGap(
                        skill_id=cov.skill_id,
                        day=cov.day,
                        start_minutes=gap_start_minutes,
                        end_minutes=gap_end_minutes,
                        required=cov.min_workers,
                        assigned=assigned,
                    )
                )
                gap_start = None
    return gaps


def _recompute_remaining_demand(
    demand: dict[tuple[int, str, int], int], assignments: list[Assignment], granularity: int
) -> dict[tuple[int, str, int], int]:
    remaining = dict(demand)
    for assignment in assignments:
        start_slot = assignment.start_minutes // granularity
        end_slot = assignment.end_minutes // granularity
        for slot in range(start_slot, end_slot):
            key = (assignment.day, assignment.skill_id, slot)
            if key in remaining:
                remaining[key] = max(0, remaining[key] - 1)
    return remaining


def _summarize_assignment_violations(
    request: SolveRequest,
    assignments: list[Assignment],
    day_dates: list[date],
    slot_settings: dict[str, int],
    skill_thresholds: dict[str, int],
) -> tuple[list[ConstraintViolation], list[CoverageGap], dict[str, float]]:
    demand, _ = _build_demand(request.coverage_windows, slot_settings["granularity"])
    workers_by_id = {worker.id: worker for worker in request.workers}
    violations: list[ConstraintViolation] = []
    total_hours_by_worker: dict[str, float] = {worker.id: 0.0 for worker in request.workers}
    by_worker_day: dict[tuple[str, int], list[Assignment]] = {}
    slot_counts: dict[tuple[int, str, int], int] = {}
    slot_rating_sum: dict[tuple[int, str, int], int] = {}

    for assignment in assignments:
        total_hours_by_worker[assignment.worker_id] = total_hours_by_worker.get(assignment.worker_id, 0.0) + (
            (assignment.end_minutes - assignment.start_minutes) / 60
        )
        by_worker_day.setdefault((assignment.worker_id, assignment.day), []).append(assignment)
        worker = workers_by_id.get(assignment.worker_id)
        rating_scaled = int(round(float(worker.skill_ratings.get(assignment.skill_id, 3)) * 100)) if worker else 300
        start_slot = assignment.start_minutes // slot_settings["granularity"]
        end_slot = assignment.end_minutes // slot_settings["granularity"]
        for slot in range(start_slot, end_slot):
            key = (assignment.day, assignment.skill_id, slot)
            slot_counts[key] = slot_counts.get(key, 0) + 1
            slot_rating_sum[key] = slot_rating_sum.get(key, 0) + rating_scaled

    for (worker_id, day), day_assignments in by_worker_day.items():
        ordered = sorted(day_assignments, key=lambda item: (item.start_minutes, item.end_minutes, item.skill_id))
        if len(ordered) > 1:
            violations.append(
                ConstraintViolation(
                    code="MULTIPLE_SHIFTS_PER_DAY",
                    message="Worker has more than one shift in the same day",
                    worker_id=worker_id,
                    day=day,
                )
            )
        for left, right in zip(ordered, ordered[1:]):
            if left.end_minutes > right.start_minutes:
                violations.append(
                    ConstraintViolation(
                        code="SHIFT_OVERLAP",
                        message="Worker shifts overlap in the same day",
                        worker_id=worker_id,
                        day=day,
                        start_minutes=right.start_minutes,
                        end_minutes=right.end_minutes,
                    )
                )

    rest_minutes = slot_settings["rest_slots"] * slot_settings["granularity"]
    by_worker: dict[str, list[Assignment]] = {}
    for assignment in assignments:
        by_worker.setdefault(assignment.worker_id, []).append(assignment)
    for worker_id, worker_assignments in by_worker.items():
        ordered = sorted(worker_assignments, key=lambda item: (item.day, item.start_minutes))
        for left, right in zip(ordered, ordered[1:]):
            if right.day == left.day + 1:
                actual_rest = (24 * 60 - left.end_minutes) + right.start_minutes
                if actual_rest < rest_minutes:
                    violations.append(
                        ConstraintViolation(
                            code="MIN_REST",
                            message="Assignments violate minimum rest between consecutive days",
                            worker_id=worker_id,
                            day=right.day,
                            start_minutes=right.start_minutes,
                            end_minutes=right.end_minutes,
                        )
                    )

    return violations, [], total_hours_by_worker


def _validate_assignments(
    request: SolveRequest,
    assignments: list[ExistingAssignment | Assignment],
    include_staffing_checks: bool = True,
) -> ValidationResponse:
    day_dates = _parse_day_dates(request)
    workers_by_id = {worker.id: worker for worker in request.workers}
    slot_settings = _settings_slots(request.settings)
    unavail_lookup = _build_unavailability_lookup(request.unavailability)
    skill_thresholds = _build_skill_thresholds(request.skill_constraints)

    assignment_responses = [_assignment_to_response(assignment, workers_by_id) for assignment in assignments]
    violations = _basic_assignment_violations(request, assignments, workers_by_id, unavail_lookup, day_dates, slot_settings)
    summary_violations, gaps, total_hours = _summarize_assignment_violations(
        request,
        assignment_responses,
        day_dates,
        slot_settings,
        skill_thresholds,
    )
    violations.extend(summary_violations)

    if include_staffing_checks:
        by_day: dict[int, list[Assignment]] = {}
        for assignment in assignment_responses:
            by_day.setdefault(assignment.day, []).append(assignment)
        for day, day_assignments in by_day.items():
            earliest = min(assignment.start_minutes for assignment in day_assignments)
            latest = max(assignment.end_minutes for assignment in day_assignments)
            earliest_group = [assignment for assignment in day_assignments if assignment.start_minutes == earliest]
            latest_group = [assignment for assignment in day_assignments if assignment.end_minutes == latest]
            if not any((workers_by_id.get(assignment.worker_id).can_open if workers_by_id.get(assignment.worker_id) else False) for assignment in earliest_group):
                violations.append(ConstraintViolation(code="CAN_OPEN", message="Earliest shift group requires at least one opener", day=day))
            if not any((workers_by_id.get(assignment.worker_id).can_close if workers_by_id.get(assignment.worker_id) else False) for assignment in latest_group):
                violations.append(ConstraintViolation(code="CAN_CLOSE", message="Latest shift group requires at least one closer", day=day))

        slot_counts: dict[tuple[int, str, int], int] = {}
        slot_rating_sum: dict[tuple[int, str, int], int] = {}
        for assignment in assignment_responses:
            worker = workers_by_id.get(assignment.worker_id)
            rating_scaled = int(round(float(worker.skill_ratings.get(assignment.skill_id, 3)) * 100)) if worker else 300
            for slot in range(assignment.start_minutes // slot_settings["granularity"], assignment.end_minutes // slot_settings["granularity"]):
                key = (assignment.day, assignment.skill_id, slot)
                slot_counts[key] = slot_counts.get(key, 0) + 1
                slot_rating_sum[key] = slot_rating_sum.get(key, 0) + rating_scaled

        for (day, skill_id, slot), assigned_count in slot_counts.items():
            threshold = skill_thresholds.get(skill_id)
            if threshold is None or assigned_count <= 0:
                continue
            if slot_rating_sum.get((day, skill_id, slot), 0) < threshold * assigned_count:
                slot_start = slot * slot_settings["granularity"]
                slot_end = slot_start + slot_settings["granularity"]
                violations.append(
                    ConstraintViolation(
                        code="MIN_TEAM_RATING",
                        message="Staffed slot does not meet the minimum average rating",
                        skill_id=skill_id,
                        day=day,
                        start_minutes=slot_start,
                        end_minutes=slot_end,
                    )
                )

        demand, _ = _build_demand(request.coverage_windows, slot_settings["granularity"])
        remaining = _recompute_remaining_demand(demand, assignment_responses, slot_settings["granularity"])
        gaps = _coverage_gaps(request.coverage_windows, assignment_responses, remaining, slot_settings["granularity"])
        for gap in gaps:
            violations.append(
                ConstraintViolation(
                    code="COVERAGE_GAP",
                    message="Coverage minimum is not satisfied",
                    skill_id=gap.skill_id,
                    day=gap.day,
                    start_minutes=gap.start_minutes,
                    end_minutes=gap.end_minutes,
                )
            )

    diagnostics = [
        f"Validated {len(assignment_responses)} assignments",
        "No hard-constraint violations found" if not violations else f"{len(violations)} hard-constraint violations found",
        "100% coverage achieved" if not gaps else f"{len(gaps)} coverage gaps remaining",
    ]
    status = "VALID" if not violations else "INVALID"
    return ValidationResponse(
        status=status,
        is_valid=not violations,
        assignments=assignment_responses,
        coverage_gaps=gaps,
        diagnostics=diagnostics,
        constraint_violations=violations,
        total_hours_by_worker=total_hours,
    )


def _candidate_bounds(extent: tuple[int, int], slots_per_day: int, min_slots: int, max_slots: int) -> tuple[int, int]:
    demand_start, demand_end = extent
    start_min = demand_start
    start_max = demand_end - min_slots
    return start_min, start_max


def _shift_overlaps_extent(start_slot: int, end_slot: int, extent: tuple[int, int]) -> bool:
    demand_start, demand_end = extent
    return start_slot < demand_end and end_slot > demand_start


def _locked_assignment_violation_response(
    validation: ValidationResponse, t0: datetime, workers: list[Worker]
) -> SolveResponse:
    total_hours_by_worker = {worker.id: 0.0 for worker in workers}
    for worker_id, hours in validation.total_hours_by_worker.items():
        total_hours_by_worker[worker_id] = hours
    return SolveResponse(
        status="INFEASIBLE",
        assignments=validation.assignments,
        coverage_gaps=validation.coverage_gaps,
        diagnostics=validation.diagnostics,
        constraint_violations=validation.constraint_violations,
        solve_time_ms=int((datetime.now() - t0).total_seconds() * 1000),
        total_hours_by_worker=total_hours_by_worker,
    )


def _enforce_open_close_greedy(assignments: list[Assignment], workers_by_id: dict[str, Worker]) -> tuple[list[Assignment], int]:
    by_day: dict[int, list[Assignment]] = {}
    for assignment in assignments:
        by_day.setdefault(assignment.day, []).append(assignment)

    kept: list[Assignment] = []
    removed = 0
    for day, day_assignments in by_day.items():
        current = list(day_assignments)
        while current:
            earliest = min(assignment.start_minutes for assignment in current)
            earliest_group = [assignment for assignment in current if assignment.start_minutes == earliest]
            if any((workers_by_id.get(assignment.worker_id).can_open if workers_by_id.get(assignment.worker_id) else False) for assignment in earliest_group):
                break
            current.remove(sorted(earliest_group, key=lambda assignment: (assignment.worker_id, assignment.skill_id))[0])
            removed += 1

        while current:
            latest = max(assignment.end_minutes for assignment in current)
            latest_group = [assignment for assignment in current if assignment.end_minutes == latest]
            if any((workers_by_id.get(assignment.worker_id).can_close if workers_by_id.get(assignment.worker_id) else False) for assignment in latest_group):
                break
            current.remove(sorted(latest_group, key=lambda assignment: (assignment.worker_id, assignment.skill_id))[0])
            removed += 1
        kept.extend(current)
    return kept, removed


def _solve_greedy(request: SolveRequest) -> SolveResponse:
    t0 = datetime.now()
    day_dates = _parse_day_dates(request)
    slot_settings = _settings_slots(request.settings)
    granularity = slot_settings["granularity"]
    min_slots = slot_settings["min_slots"]
    max_slots = slot_settings["max_slots"]
    soft_min_slots = slot_settings["soft_min_slots"]
    soft_max_slots = slot_settings["soft_max_slots"]
    slots_per_day = slot_settings["slots_per_day"]
    rest_minutes = slot_settings["rest_slots"] * granularity

    workers = request.workers
    workers_by_id = {worker.id: worker for worker in workers}
    unavail_lookup = _build_unavailability_lookup(request.unavailability)
    skill_thresholds = _build_skill_thresholds(request.skill_constraints)
    demand, extent = _build_demand(request.coverage_windows, granularity)
    cov_boundaries = _build_coverage_boundaries(request.coverage_windows, granularity, max_slots=max_slots)
    remaining = dict(demand)

    locked_validation = _validate_assignments(
        request,
        [assignment for assignment in request.existing_assignments if assignment.is_locked],
        include_staffing_checks=False,
    )
    if not locked_validation.is_valid:
        return _locked_assignment_violation_response(locked_validation, t0, workers)

    existing_keys = {
        (assignment.worker_id, assignment.day, assignment.skill_id, assignment.start_minutes // granularity, assignment.end_minutes // granularity): assignment
        for assignment in request.existing_assignments
    }

    assignments = [_assignment_to_response(assignment, workers_by_id) for assignment in request.existing_assignments if assignment.is_locked]
    total_hours = {worker.id: 0.0 for worker in workers}
    assigned_days: dict[str, set[int]] = {worker.id: set() for worker in workers}
    assigned_worker_day: dict[tuple[str, int], Assignment] = {}
    slot_counts: dict[tuple[int, str, int], int] = {}
    slot_rating_sum: dict[tuple[int, str, int], int] = {}
    baseline_month_slots = _build_worker_month_baseline(request, granularity)
    month_slots_assigned: dict[tuple[str, str], int] = {}

    for assignment in assignments:
        assigned_days[assignment.worker_id].add(assignment.day)
        assigned_worker_day[(assignment.worker_id, assignment.day)] = assignment
        total_hours[assignment.worker_id] += (assignment.end_minutes - assignment.start_minutes) / 60
        worker = workers_by_id.get(assignment.worker_id)
        rating_scaled = int(round(float(worker.skill_ratings.get(assignment.skill_id, 3)) * 100)) if worker else 300
        month_key = _month_start_for_date(day_dates[assignment.day])
        month_slots_assigned[(assignment.worker_id, month_key)] = month_slots_assigned.get((assignment.worker_id, month_key), 0) + (
            (assignment.end_minutes - assignment.start_minutes) // granularity
        )
        for slot in range(assignment.start_minutes // granularity, assignment.end_minutes // granularity):
            key = (assignment.day, assignment.skill_id, slot)
            if key in remaining:
                remaining[key] = max(0, remaining[key] - 1)
            slot_counts[key] = slot_counts.get(key, 0) + 1
            slot_rating_sum[key] = slot_rating_sum.get(key, 0) + rating_scaled

    unmatched_existing = 0
    day_skills = sorted(
        set((day, skill_id) for (day, skill_id, _) in demand),
        key=lambda item: -sum(demand.get((item[0], item[1], slot), 0) for slot in range(slots_per_day)),
    )

    for day, skill_id in day_skills:
        bounds = cov_boundaries.get((day, skill_id))
        if bounds is None:
            continue
        demand_start = bounds[0]
        demand_end = bounds[-1]

        eligible_workers = sorted(
            (
                worker
                for worker in workers
                if day not in assigned_days[worker.id] and _worker_is_eligible(worker, request, skill_id, day_dates[day])
            ),
            key=lambda worker: (total_hours[worker.id], -(worker.skill_ratings.get(skill_id, 3))),
        )

        for worker in eligible_workers:
            if not any(remaining.get((day, skill_id, slot), 0) > 0 for slot in range(demand_start, demand_end)):
                break

            best_key = None
            best_score = None
            for i, start_slot in enumerate(bounds):
                for end_slot in bounds[i + 1:]:
                    length = end_slot - start_slot
                    if length < min_slots or length > max_slots:
                        continue
                    start_minutes = start_slot * granularity
                    end_minutes = end_slot * granularity
                    if not _is_shift_available(worker.id, day, start_minutes, end_minutes, unavail_lookup):
                        continue
                    previous_assignment = assigned_worker_day.get((worker.id, day - 1))
                    next_assignment = assigned_worker_day.get((worker.id, day + 1))
                    if previous_assignment and (24 * 60 - previous_assignment.end_minutes) + start_minutes < rest_minutes:
                        continue
                    if next_assignment and (24 * 60 - end_minutes) + next_assignment.start_minutes < rest_minutes:
                        continue

                    threshold = skill_thresholds.get(skill_id)
                    rating_scaled = int(round(float(worker.skill_ratings.get(skill_id, 3)) * 100))
                    if threshold is not None:
                        violates_rating = False
                        for slot in range(start_slot, end_slot):
                            count = slot_counts.get((day, skill_id, slot), 0) + 1
                            rating_sum = slot_rating_sum.get((day, skill_id, slot), 0) + rating_scaled
                            if rating_sum < threshold * count:
                                violates_rating = True
                                break
                        if violates_rating:
                            continue

                    coverage_slots = sum(min(remaining.get((day, skill_id, slot), 0), 1) for slot in range(start_slot, end_slot))
                    if coverage_slots <= 0:
                        continue

                    month_key = _month_start_for_date(day_dates[day])
                    assigned_month_slots = month_slots_assigned.get((worker.id, month_key), 0)
                    baseline_slots = baseline_month_slots.get((worker.id, month_key), 0)
                    current_slots = assigned_month_slots + baseline_slots
                    length_slots = end_slot - start_slot
                    monthly_bonus = 0
                    if worker.monthly_min_hours is not None:
                        min_target_slots = int(round(float(worker.monthly_min_hours) * 60 / granularity))
                        monthly_bonus += max(0, min_target_slots - current_slots) * min(length_slots, max(0, min_target_slots - current_slots)) * 2
                    if worker.monthly_optimal_hours is not None:
                        optimal_target_slots = int(round(float(worker.monthly_optimal_hours) * 60 / granularity))
                        before_diff = abs(current_slots - optimal_target_slots)
                        after_diff = abs(current_slots + length_slots - optimal_target_slots)
                        monthly_bonus += max(0, before_diff - after_diff) * 8

                    balance_bonus = 0
                    if worker.monthly_min_hours is None and worker.monthly_optimal_hours is None and request.balance_hours:
                        balance_bonus = int(max(0, 100 - total_hours[worker.id] * 10))

                    change_bonus = 0
                    key = (worker.id, day, skill_id, start_slot, end_slot)
                    if request.minimize_changes and key in existing_keys:
                        change_bonus = 5000

                    overtime = max(0, length_slots - soft_max_slots)
                    undertime = max(0, soft_min_slots - length_slots)
                    shift_score = (length_slots * 5) - (overtime * overtime * 25) - (undertime * undertime * 25)
                    score = coverage_slots * 100000 + change_bonus + monthly_bonus + balance_bonus + shift_score
                    if best_score is None or score > best_score:
                        best_score = score
                        best_key = (start_slot, end_slot, key)

            if best_key is None:
                continue

            start_slot, end_slot, key = best_key
            start_minutes = start_slot * granularity
            end_minutes = end_slot * granularity
            assignment = Assignment(
                worker_id=worker.id,
                worker_name=worker.name,
                skill_id=skill_id,
                day=day,
                start_minutes=start_minutes,
                end_minutes=end_minutes,
                is_locked=bool(existing_keys.get(key).is_locked) if key in existing_keys else False,
            )
            assignments.append(assignment)
            assigned_days[worker.id].add(day)
            assigned_worker_day[(worker.id, day)] = assignment
            total_hours[worker.id] += (end_minutes - start_minutes) / 60
            month_key = _month_start_for_date(day_dates[day])
            month_slots_assigned[(worker.id, month_key)] = month_slots_assigned.get((worker.id, month_key), 0) + (end_slot - start_slot)
            rating_scaled = int(round(float(worker.skill_ratings.get(skill_id, 3)) * 100))
            for slot in range(start_slot, end_slot):
                demand_key = (day, skill_id, slot)
                if demand_key in remaining:
                    remaining[demand_key] = max(0, remaining[demand_key] - 1)
                slot_counts[demand_key] = slot_counts.get(demand_key, 0) + 1
                slot_rating_sum[demand_key] = slot_rating_sum.get(demand_key, 0) + rating_scaled

    for existing in request.existing_assignments:
        if existing.is_locked:
            continue
        key = (
            existing.worker_id,
            existing.day,
            existing.skill_id,
            existing.start_minutes // granularity,
            existing.end_minutes // granularity,
        )
        if request.minimize_changes and key not in existing_keys:
            unmatched_existing += 1

    assignments, removed_for_open_close = _enforce_open_close_greedy(assignments, workers_by_id)
    validation = _validate_assignments(request, assignments)
    solve_ms = int((datetime.now() - t0).total_seconds() * 1000)
    diagnostics = [
        f"Generated {len(assignments)} shifts (greedy)",
        f"Solve time: {solve_ms}ms",
        "100% coverage achieved" if not validation.coverage_gaps else f"{len(validation.coverage_gaps)} coverage gaps remaining",
    ]
    if unmatched_existing:
        diagnostics.append(f"{unmatched_existing} existing assignments could not be preserved exactly")
    if removed_for_open_close:
        diagnostics.append(f"Removed {removed_for_open_close} edge shifts to enforce can_open/can_close")
    diagnostics.extend(validation.diagnostics[1:])
    status = "OPTIMAL" if not validation.constraint_violations else ("FEASIBLE" if assignments else "INFEASIBLE")
    return SolveResponse(
        status=status,
        assignments=validation.assignments,
        coverage_gaps=validation.coverage_gaps,
        diagnostics=diagnostics,
        constraint_violations=validation.constraint_violations,
        solve_time_ms=solve_ms,
        total_hours_by_worker=validation.total_hours_by_worker,
    )


def _solve_cpsat(request: SolveRequest, progress_queue: queue_module.Queue | None = None) -> SolveResponse:
    t0 = datetime.now()
    day_dates = _parse_day_dates(request)
    slot_settings = _settings_slots(request.settings)
    granularity = slot_settings["granularity"]
    min_slots = slot_settings["min_slots"]
    max_slots = slot_settings["max_slots"]
    soft_min_slots = slot_settings["soft_min_slots"]
    soft_max_slots = slot_settings["soft_max_slots"]
    rest_slots = slot_settings["rest_slots"]
    slots_per_day = slot_settings["slots_per_day"]
    workers = request.workers
    workers_by_id = {worker.id: worker for worker in workers}
    demand, extent = _build_demand(request.coverage_windows, granularity)
    cov_boundaries = _build_coverage_boundaries(request.coverage_windows, granularity, max_slots=max_slots)
    skill_thresholds = _build_skill_thresholds(request.skill_constraints)
    unavail_lookup = _build_unavailability_lookup(request.unavailability)
    baseline_month_slots = _build_worker_month_baseline(request, granularity)

    locked_assignments = [assignment for assignment in request.existing_assignments if assignment.is_locked]
    locked_validation = _validate_assignments(request, locked_assignments, include_staffing_checks=False)
    if not locked_validation.is_valid:
        return _locked_assignment_violation_response(locked_validation, t0, workers)

    model = cp_model.CpModel()
    shift_vars: dict[tuple[int, int, str, int, int], cp_model.IntVar] = {}

    for worker_index, worker in enumerate(workers):
        for day, day_date in enumerate(day_dates):
            for skill_id in worker.skill_ids:
                if not _worker_is_eligible(worker, request, skill_id, day_date):
                    continue
                bounds = cov_boundaries.get((day, skill_id))
                if bounds is None:
                    continue
                for i, start_slot in enumerate(bounds):
                    for end_slot in bounds[i + 1:]:
                        length = end_slot - start_slot
                        if length < min_slots or length > max_slots:
                            continue
                        if not _is_shift_available(worker.id, day, start_slot * granularity, end_slot * granularity, unavail_lookup):
                            continue
                        shift_vars[(worker_index, day, skill_id, start_slot, end_slot)] = model.NewBoolVar(
                            f"x_{worker_index}_{day}_{skill_id}_{start_slot}_{end_slot}"
                        )

    violation_hints: list[ConstraintViolation] = []
    worker_index_by_id = {worker.id: index for index, worker in enumerate(workers)}
    for assignment in locked_assignments:
        worker_index = worker_index_by_id.get(assignment.worker_id)
        if worker_index is None:
            continue
        key = (
            worker_index,
            assignment.day,
            assignment.skill_id,
            assignment.start_minutes // granularity,
            assignment.end_minutes // granularity,
        )
        if key not in shift_vars:
            shift_vars[key] = model.NewBoolVar(
                f"x_locked_{worker_index}_{assignment.day}_{assignment.skill_id}_{assignment.start_minutes // granularity}_{assignment.end_minutes // granularity}"
            )

    slot_vars: dict[tuple[int, str, int], list[cp_model.IntVar]] = {}
    slot_rating_terms: dict[tuple[int, str, int], list[tuple[cp_model.IntVar, int]]] = {}
    worker_day_vars: dict[tuple[int, int], list[tuple[int, int, str, cp_model.IntVar]]] = {}
    day_slot_vars: dict[tuple[int, int], list[cp_model.IntVar]] = {}
    day_open_slot_vars: dict[tuple[int, int], list[cp_model.IntVar]] = {}
    day_close_slot_vars: dict[tuple[int, int], list[cp_model.IntVar]] = {}

    for (worker_index, day, skill_id, start_slot, end_slot), variable in shift_vars.items():
        worker = workers[worker_index]
        rating_scaled = int(round(float(worker.skill_ratings.get(skill_id, 3)) * 100))
        worker_day_vars.setdefault((worker_index, day), []).append((start_slot, end_slot, skill_id, variable))
        for slot in range(start_slot, end_slot):
            slot_vars.setdefault((day, skill_id, slot), []).append(variable)
            slot_rating_terms.setdefault((day, skill_id, slot), []).append((variable, rating_scaled))
            day_slot_vars.setdefault((day, slot), []).append(variable)
            if worker.can_open:
                day_open_slot_vars.setdefault((day, slot), []).append(variable)
            if worker.can_close:
                day_close_slot_vars.setdefault((day, slot), []).append(variable)

    for (worker_index, day), variables in worker_day_vars.items():
        model.Add(sum(variable for _, _, _, variable in variables) <= 1)

    for worker_index in range(len(workers)):
        for day in range(len(day_dates) - 1):
            left = worker_day_vars.get((worker_index, day), [])
            right = worker_day_vars.get((worker_index, day + 1), [])
            for left_start, left_end, _, left_var in left:
                for right_start, _, _, right_var in right:
                    rest = slots_per_day - left_end + right_start
                    if rest < rest_slots:
                        model.Add(left_var + right_var <= 1)

    slack_vars: dict[tuple[int, str, int], cp_model.IntVar] = {}
    for (day, skill_id, slot), required in demand.items():
        slack = model.NewIntVar(0, required, f"slack_{day}_{skill_id}_{slot}")
        covering = slot_vars.get((day, skill_id, slot), [])
        model.Add((sum(covering) if covering else 0) + slack >= required)
        slack_vars[(day, skill_id, slot)] = slack

    for (day, skill_id, slot), covering in slot_vars.items():
        threshold = skill_thresholds.get(skill_id)
        if threshold is None or not covering:
            continue
        rating_terms = slot_rating_terms.get((day, skill_id, slot), [])
        rating_sum = sum(rating * variable for variable, rating in rating_terms)
        model.Add(rating_sum >= threshold * sum(covering))

    day_to_slots: dict[int, list[int]] = {}
    for day, slot in day_slot_vars.keys():
        day_to_slots.setdefault(day, []).append(slot)
    for day, slots in day_to_slots.items():
        unique_slots = sorted(set(slots))
        day_variables = [variable for vars_for_day in worker_day_vars.values() for _, _, _, variable in vars_for_day if any(key_day == day for key_worker, key_day in [next(iter(worker_day_vars.keys()))])]
        day_variables = [variable for (worker_index, key_day), entries in worker_day_vars.items() if key_day == day for _, _, _, variable in entries]
        if not day_variables:
            continue
        day_has_assignments = model.NewBoolVar(f"day_has_{day}")
        model.Add(sum(day_variables) >= 1).OnlyEnforceIf(day_has_assignments)
        model.Add(sum(day_variables) == 0).OnlyEnforceIf(day_has_assignments.Not())

        staffed_flags: dict[int, cp_model.IntVar] = {}
        for slot in unique_slots:
            staffed = model.NewBoolVar(f"staffed_{day}_{slot}")
            covering = day_slot_vars.get((day, slot), [])
            if covering:
                model.Add(sum(covering) >= 1).OnlyEnforceIf(staffed)
                model.Add(sum(covering) == 0).OnlyEnforceIf(staffed.Not())
            else:
                model.Add(staffed == 0)
            staffed_flags[slot] = staffed

        first_flags: dict[int, cp_model.IntVar] = {}
        for slot in unique_slots:
            first = model.NewBoolVar(f"first_{day}_{slot}")
            model.Add(first <= staffed_flags[slot])
            for previous in unique_slots:
                if previous >= slot:
                    break
                model.Add(first + staffed_flags[previous] <= 1)
            open_covering = day_open_slot_vars.get((day, slot), [])
            if open_covering:
                model.Add(sum(open_covering) >= 1).OnlyEnforceIf(first)
            else:
                model.Add(first == 0)
            first_flags[slot] = first
        model.Add(sum(first_flags.values()) == day_has_assignments)

        last_flags: dict[int, cp_model.IntVar] = {}
        for slot in unique_slots:
            last = model.NewBoolVar(f"last_{day}_{slot}")
            model.Add(last <= staffed_flags[slot])
            for following in unique_slots:
                if following <= slot:
                    continue
                model.Add(last + staffed_flags[following] <= 1)
            close_covering = day_close_slot_vars.get((day, slot), [])
            if close_covering:
                model.Add(sum(close_covering) >= 1).OnlyEnforceIf(last)
            else:
                model.Add(last == 0)
            last_flags[slot] = last
        model.Add(sum(last_flags.values()) == day_has_assignments)

    unmatched_existing = 0
    objectives: list[cp_model.LinearExpr] = []
    for slack in slack_vars.values():
        objectives.append(slack * 1000000)

    if request.minimize_changes:
        for assignment in request.existing_assignments:
            if assignment.is_locked:
                continue
            worker_index = worker_index_by_id.get(assignment.worker_id)
            if worker_index is None:
                unmatched_existing += 1
                violation_hints.append(
                    ConstraintViolation(
                        code="UNMATCHED_EXISTING_ASSIGNMENT",
                        message="Existing assignment references an unknown worker",
                        worker_id=assignment.worker_id,
                        skill_id=assignment.skill_id,
                        day=assignment.day,
                        start_minutes=assignment.start_minutes,
                        end_minutes=assignment.end_minutes,
                    )
                )
                continue
            key = (
                worker_index,
                assignment.day,
                assignment.skill_id,
                assignment.start_minutes // granularity,
                assignment.end_minutes // granularity,
            )
            variable = shift_vars.get(key)
            if variable is None:
                unmatched_existing += 1
                violation_hints.append(
                    ConstraintViolation(
                        code="UNMATCHED_EXISTING_ASSIGNMENT",
                        message="Existing assignment could not be preserved exactly under the current constraints",
                        worker_id=assignment.worker_id,
                        skill_id=assignment.skill_id,
                        day=assignment.day,
                        start_minutes=assignment.start_minutes,
                        end_minutes=assignment.end_minutes,
                    )
                )
                continue
            removed = model.NewBoolVar(
                f"removed_{worker_index}_{assignment.day}_{assignment.skill_id}_{assignment.start_minutes // granularity}_{assignment.end_minutes // granularity}"
            )
            model.Add(variable + removed == 1)
            objectives.append(removed * 10000)

    days_by_month: dict[str, list[int]] = {}
    for day, day_date in enumerate(day_dates):
        days_by_month.setdefault(_month_start_for_date(day_date), []).append(day)

    for worker_index, worker in enumerate(workers):
        for month_start, month_days in days_by_month.items():
            month_variables = [
                (end_slot - start_slot, variable)
                for (index, day, skill_id, start_slot, end_slot), variable in shift_vars.items()
                if index == worker_index and day in month_days
            ]
            if not month_variables:
                continue
            assigned_slots_expr = sum(length * variable for length, variable in month_variables)
            baseline_slots = baseline_month_slots.get((worker.id, month_start), 0)

            if worker.monthly_min_hours is not None:
                target_slots = int(round(float(worker.monthly_min_hours) * 60 / granularity))
                shortfall = model.NewIntVar(0, max(0, target_slots), f"min_shortfall_{worker_index}_{month_start}")
                model.Add(shortfall >= target_slots - (baseline_slots + assigned_slots_expr))
                objectives.append(shortfall * 200)

            if worker.monthly_optimal_hours is not None:
                target_slots = int(round(float(worker.monthly_optimal_hours) * 60 / granularity))
                max_dev = slots_per_day * len(month_days)
                deviation = model.NewIntVar(0, max_dev, f"optimal_dev_{worker_index}_{month_start}")
                model.Add(deviation >= baseline_slots + assigned_slots_expr - target_slots)
                model.Add(deviation >= target_slots - (baseline_slots + assigned_slots_expr))
                dev_squared = model.NewIntVar(0, max_dev * max_dev, f"dev_sq_{worker_index}_{month_start}")
                model.AddMultiplicationEquality(dev_squared, [deviation, deviation])
                objectives.append(dev_squared * 2)
                objectives.append(deviation * 10)

    if request.balance_hours and len(workers) > 1:
        total_demand_slots = sum(demand.values())
        available_slots_per_worker: list[int] = []
        for worker in workers:
            total_available = 0
            for day in range(len(day_dates)):
                if not any(_worker_is_eligible(worker, request, skill_id, day_dates[day]) for _, skill_id in [(day, skill_id) for (day_key, skill_id), _ in extent.items() if day_key == day]):
                    continue
                day_available = slots_per_day
                for ua in unavail_lookup.get((worker.id, day), []):
                    if ua.is_full_day:
                        day_available = 0
                        break
                    if ua.start_minutes is not None and ua.end_minutes is not None:
                        day_available -= max(0, (ua.end_minutes - ua.start_minutes) // granularity)
                total_available += max(0, day_available)
            available_slots_per_worker.append(total_available)

        total_available_slots = sum(available_slots_per_worker)
        if total_available_slots > 0:
            for worker_index, worker in enumerate(workers):
                worker_variables = [
                    (end_slot - start_slot, variable)
                    for (index, day, skill_id, start_slot, end_slot), variable in shift_vars.items()
                    if index == worker_index
                ]
                if not worker_variables:
                    continue
                target = (total_demand_slots * available_slots_per_worker[worker_index]) // total_available_slots
                assigned_expr = sum(length * variable for length, variable in worker_variables)
                deviation = model.NewIntVar(0, slots_per_day * len(day_dates), f"balance_dev_{worker_index}")
                model.Add(deviation >= assigned_expr - target)
                model.Add(deviation >= target - assigned_expr)
                objectives.append(deviation * 10)

    for (worker_index, day, skill_id, start_slot, end_slot), variable in shift_vars.items():
        length = end_slot - start_slot
        shortfall = max(0, soft_max_slots - length)
        overtime = max(0, length - soft_max_slots)
        undertime = max(0, soft_min_slots - length)
        objectives.append(variable * shortfall * 50)
        if overtime > 0:
            objectives.append(variable * (overtime * overtime * 15))
        if undertime > 0:
            objectives.append(variable * (undertime * undertime * 15))
        wasted = sum(1 for s in range(start_slot, end_slot) if (day, skill_id, s) not in demand)
        if wasted > 0:
            objectives.append(variable * wasted * 500)

    for assignment in locked_assignments:
        worker_index = worker_index_by_id[assignment.worker_id]
        key = (
            worker_index,
            assignment.day,
            assignment.skill_id,
            assignment.start_minutes // granularity,
            assignment.end_minutes // granularity,
        )
        model.Add(shift_vars[key] == 1)

    if objectives:
        model.Minimize(sum(objectives))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = request.solver_timeout_seconds
    solver.parameters.num_search_workers = min(8, os.cpu_count() or 4)
    solver.parameters.relative_gap_limit = 0.005
    solver.parameters.linearization_level = 2
    if progress_queue is not None:
        progress_queue.put({"type": "phase", "phase": "solving", "variables": len(shift_vars)})
    callback = _SolveProgressCallback(progress_queue)
    status = solver.Solve(model, callback)
    solve_ms = int((datetime.now() - t0).total_seconds() * 1000)

    assignments: list[Assignment] = []
    if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        locked_keys = {
            (
                assignment.worker_id,
                assignment.day,
                assignment.skill_id,
                assignment.start_minutes // granularity,
                assignment.end_minutes // granularity,
            )
            for assignment in locked_assignments
        }
        for (worker_index, day, skill_id, start_slot, end_slot), variable in shift_vars.items():
            if solver.Value(variable) != 1:
                continue
            worker = workers[worker_index]
            assignments.append(
                Assignment(
                    worker_id=worker.id,
                    worker_name=worker.name,
                    skill_id=skill_id,
                    day=day,
                    start_minutes=start_slot * granularity,
                    end_minutes=end_slot * granularity,
                    is_locked=(worker.id, day, skill_id, start_slot, end_slot) in locked_keys,
                )
            )

    validation = _validate_assignments(request, assignments)
    diagnostics = [
        f"Generated {len(assignments)} shifts (CP-SAT)",
        f"Solve time: {solve_ms}ms",
        "100% coverage achieved" if not validation.coverage_gaps else f"{len(validation.coverage_gaps)} coverage gaps remaining",
    ]
    if unmatched_existing:
        diagnostics.append(f"{unmatched_existing} existing assignments could not be preserved exactly")
    diagnostics.extend(validation.diagnostics[1:])

    combined_violations = violation_hints + validation.constraint_violations
    if status == cp_model.INFEASIBLE:
        status_str = "INFEASIBLE"
    elif not validation.constraint_violations:
        status_str = "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE"
    else:
        status_str = "FEASIBLE" if assignments else "INFEASIBLE"

    return SolveResponse(
        status=status_str,
        assignments=validation.assignments,
        coverage_gaps=validation.coverage_gaps,
        diagnostics=diagnostics,
        constraint_violations=combined_violations,
        solve_time_ms=solve_ms,
        total_hours_by_worker=validation.total_hours_by_worker,
    )


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "clocked-solver-v2",
        "solver": "cpsat" if ORTOOLS_AVAILABLE else "greedy",
    }


@app.post("/solve", response_model=SolveResponse)
async def solve_schedule(request: SolveRequest):
    if not request.workers:
        raise HTTPException(status_code=400, detail="No workers provided")
    if not request.coverage_windows:
        raise HTTPException(status_code=400, detail="No coverage windows provided")
    try:
        if ORTOOLS_AVAILABLE:
            return _solve_cpsat(request)
        return _solve_greedy(request)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Solver error: {str(exc)}")


@app.post("/solve/stream")
async def solve_schedule_stream(request: SolveRequest):
    """SSE streaming endpoint — sends progress events while solving, then the final result."""
    if not request.workers:
        raise HTTPException(status_code=400, detail="No workers provided")
    if not request.coverage_windows:
        raise HTTPException(status_code=400, detail="No coverage windows provided")

    progress_queue: queue_module.Queue = queue_module.Queue()
    result_holder: list[SolveResponse | Exception] = []

    def _run_solver():
        try:
            progress_queue.put({"type": "phase", "phase": "building_model"})
            if ORTOOLS_AVAILABLE:
                result = _solve_cpsat(request, progress_queue=progress_queue)
            else:
                result = _solve_greedy(request)
            result_holder.append(result)
        except Exception as exc:
            result_holder.append(exc)
        finally:
            progress_queue.put({"type": "done"})

    solver_thread = threading.Thread(target=_run_solver, daemon=True)
    solver_thread.start()

    async def _event_stream():
        day_count = (date.fromisoformat(request.end_date) - date.fromisoformat(request.start_date)).days
        yield f"event: started\ndata: {json.dumps({'workers': len(request.workers), 'days': day_count, 'coverage_windows': len(request.coverage_windows)})}\n\n"
        while True:
            try:
                event = progress_queue.get_nowait()
            except queue_module.Empty:
                await asyncio.sleep(0.25)
                continue

            if event["type"] == "done":
                if result_holder and isinstance(result_holder[0], SolveResponse):
                    result = result_holder[0]
                    yield f"event: complete\ndata: {result.model_dump_json()}\n\n"
                elif result_holder and isinstance(result_holder[0], Exception):
                    yield f"event: error\ndata: {json.dumps({'detail': str(result_holder[0])})}\n\n"
                else:
                    yield f"event: error\ndata: {json.dumps({'detail': 'Solver returned no result'})}\n\n"
                break
            elif event["type"] == "progress":
                yield f"event: progress\ndata: {json.dumps(event)}\n\n"
            elif event["type"] == "phase":
                yield f"event: phase\ndata: {json.dumps(event)}\n\n"

    return StreamingResponse(_event_stream(), media_type="text/event-stream")


@app.post("/validate", response_model=ValidationResponse)
async def validate_schedule(request: SolveRequest):
    assignments = request.existing_assignments
    return _validate_assignments(request, assignments)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
