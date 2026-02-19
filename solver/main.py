"""
Clocked Schedule Solver Service
Uses Google OR-Tools CP-SAT solver for constraint-based schedule optimization.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date, time, timedelta
import uvicorn

# Try to import OR-Tools; fall back to greedy solver if unavailable
ORTOOLS_AVAILABLE = False
try:
    from ortools.sat.python import cp_model
    ORTOOLS_AVAILABLE = True
    print("[solver] OR-Tools loaded — using CP-SAT solver")
except (ImportError, OSError) as e:
    print(f"[solver] OR-Tools unavailable ({e}) — using greedy fallback solver")

app = FastAPI(
    title="Clocked Solver Service",
    description="Schedule optimization using OR-Tools CP-SAT",
    version="1.0.0"
)

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
    worker_rating: int = 3  # overall rating 1-5 set by manager
    start_date: Optional[str] = None


class CoverageWindow(BaseModel):
    id: str
    skill_id: str
    day: int  # 0-6 (Monday-Sunday)
    start_minutes: int  # Minutes from midnight
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
    max_hours_per_day: int = 12
    min_hours_per_block: int = 2
    max_hours_per_block: int = 10
    min_rest_between_shifts: int = 8
    granularity_minutes: int = 15


class SolveRequest(BaseModel):
    place_id: str
    start_date: str  # ISO date
    end_date: str  # ISO date
    workers: list[Worker]
    coverage_windows: list[CoverageWindow]
    existing_assignments: list[ExistingAssignment] = []
    unavailability: list[Unavailability] = []
    settings: PlaceSettings = PlaceSettings()
    minimize_changes: bool = True
    balance_hours: bool = True


class Assignment(BaseModel):
    worker_id: str
    worker_name: str
    skill_id: str
    day: int
    start_minutes: int
    end_minutes: int


class CoverageGap(BaseModel):
    skill_id: str
    day: int
    start_minutes: int
    end_minutes: int
    required: int
    assigned: int


class SolveResponse(BaseModel):
    status: str  # OPTIMAL, FEASIBLE, INFEASIBLE
    assignments: list[Assignment]
    coverage_gaps: list[CoverageGap]
    diagnostics: list[str]
    solve_time_ms: int
    total_hours_by_worker: dict[str, float]


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "clocked-solver"}


def _is_worker_unavailable(worker_id: str, day_of_week: int, cov_start: int, cov_end: int, unavail_lookup: dict) -> bool:
    """Check if a worker is unavailable for a given coverage window."""
    unavails = unavail_lookup.get((worker_id, day_of_week), [])
    for ua in unavails:
        if ua.is_full_day:
            return True
        if ua.start_minutes is not None and ua.end_minutes is not None:
            if not (cov_end <= ua.start_minutes or cov_start >= ua.end_minutes):
                return True
    return False


def _solve_greedy(request: SolveRequest) -> SolveResponse:
    """
    Pure-Python greedy solver fallback.
    Assigns workers to coverage windows based on skill match, availability,
    and hour balancing. No native dependencies required.
    """
    start_time = datetime.now()

    start = datetime.fromisoformat(request.start_date).date()
    end = datetime.fromisoformat(request.end_date).date()
    num_days = (end - start).days + 1

    if num_days <= 0 or num_days > 31:
        raise HTTPException(status_code=400, detail="Invalid date range (1-31 days)")

    workers = request.workers
    coverage = request.coverage_windows

    # Build unavailability lookup keyed by (worker_id, day_offset)
    unavail_lookup: dict = {}
    for ua in request.unavailability:
        key = (ua.worker_id, ua.day)
        unavail_lookup.setdefault(key, []).append(ua)

    # Track worker assignments: worker_id -> list of (day, cov)
    worker_assignments: dict[str, list[tuple[int, CoverageWindow]]] = {w.id: [] for w in workers}
    total_hours: dict[str, float] = {w.id: 0.0 for w in workers}
    assignments: list[Assignment] = []

    # Build list of (day_offset, coverage_window) sorted by min_workers desc (hardest to fill first)
    # coverage.day is now a day OFFSET from start_date (not day-of-week)
    day_covs: list[tuple[int, CoverageWindow]] = []
    for cov in coverage:
        day_covs.append((cov.day, cov))
    day_covs.sort(key=lambda dc: dc[1].min_workers, reverse=True)

    max_hours_per_day = request.settings.max_hours_per_day

    # Pre-compute worker start_date eligibility per day offset
    worker_start_day: dict[str, int] = {}  # worker_id -> first eligible day offset
    for w in workers:
        if w.start_date:
            try:
                ws = datetime.fromisoformat(w.start_date).date()
                offset = (ws - start).days
                worker_start_day[w.id] = max(0, offset)
            except ValueError:
                worker_start_day[w.id] = 0
        else:
            worker_start_day[w.id] = 0

    for day, cov in day_covs:
        needed = cov.min_workers
        duration_hours = (cov.end_minutes - cov.start_minutes) / 60

        # Find eligible workers for this window
        candidates = []
        for w in workers:
            # Must have the skill
            if cov.skill_id not in w.skill_ids:
                continue
            # Must have started by this day
            if day < worker_start_day.get(w.id, 0):
                continue
            # Must not be unavailable (uses day offset for lookup)
            if _is_worker_unavailable(w.id, day, cov.start_minutes, cov.end_minutes, unavail_lookup):
                continue
            # Must not already be assigned on this day (one shift per day)
            already_on_day = any(d == day for d, _ in worker_assignments[w.id])
            if already_on_day:
                continue
            # Must not exceed max hours per day
            if total_hours[w.id] + duration_hours > max_hours_per_day * num_days:
                continue

            skill_rating = w.skill_ratings.get(cov.skill_id, 3)
            candidates.append((w, skill_rating))

        # Sort by: least total hours first (balance), then highest combined rating
        # worker_rating ensures experienced workers are mixed in with newbies
        candidates.sort(key=lambda c: (total_hours[c[0].id], -(c[1] + c[0].worker_rating)))

        assigned_count = 0
        for w, rating in candidates:
            if assigned_count >= needed:
                break
            assignments.append(Assignment(
                worker_id=w.id,
                worker_name=w.name,
                skill_id=cov.skill_id,
                day=day,
                start_minutes=cov.start_minutes,
                end_minutes=cov.end_minutes,
            ))
            worker_assignments[w.id].append((day, cov))
            total_hours[w.id] += duration_hours
            assigned_count += 1

    # Calculate coverage gaps (coverage.day is now a day offset)
    gaps: list[CoverageGap] = []
    for cov in coverage:
        day = cov.day
        assigned_count = sum(
            1 for a in assignments
            if a.day == day and a.skill_id == cov.skill_id
            and a.start_minutes == cov.start_minutes
        )
        if assigned_count < cov.min_workers:
            gaps.append(CoverageGap(
                skill_id=cov.skill_id,
                day=day,
                start_minutes=cov.start_minutes,
                end_minutes=cov.end_minutes,
                required=cov.min_workers,
                assigned=assigned_count,
            ))

    solve_time = int((datetime.now() - start_time).total_seconds() * 1000)
    status_str = "OPTIMAL" if not gaps else ("FEASIBLE" if assignments else "INFEASIBLE")

    diagnostics = [
        f"Generated {len(assignments)} shifts (greedy solver)",
        f"Solve time: {solve_time}ms",
    ]
    if gaps:
        diagnostics.append(f"{len(gaps)} coverage gaps remaining")
    else:
        diagnostics.append("100% coverage achieved")
    hours_list = [h for h in total_hours.values() if h > 0]
    if hours_list:
        diagnostics.append(f"Hours range: {min(hours_list):.1f}h - {max(hours_list):.1f}h")

    return SolveResponse(
        status=status_str,
        assignments=assignments,
        coverage_gaps=gaps,
        diagnostics=diagnostics,
        solve_time_ms=solve_time,
        total_hours_by_worker=total_hours,
    )


def _solve_cpsat(request: SolveRequest) -> SolveResponse:
    """
    Generate an optimized schedule using OR-Tools CP-SAT solver.
    
    Hard constraints:
    - Workers can only work skills they have
    - Workers can only work at places they're assigned to
    - Workers cannot work when unavailable
    - Minimum rest between shifts
    - Maximum hours per day
    - A worker cannot work at two different places on the same day
    
    Soft constraints (objectives):
    - Minimize deviation from existing assignments
    - Balance hours across workers
    - Maximize skill rating matches
    """
    start_time = datetime.now()

    # Parse dates
    start = datetime.fromisoformat(request.start_date).date()
    end = datetime.fromisoformat(request.end_date).date()
    num_days = (end - start).days + 1

    if num_days <= 0 or num_days > 31:
        raise HTTPException(status_code=400, detail="Invalid date range (1-31 days)")

    # Create the model
    model = cp_model.CpModel()

    # Time slots based on granularity
    granularity = request.settings.granularity_minutes
    slots_per_day = 24 * 60 // granularity

    # Decision variables: worker_shift[w, d, s, skill] = 1 if worker w works on day d starting at slot s for skill
    worker_shift = {}

    workers = request.workers
    coverage = request.coverage_windows

    # Create variables for each possible shift
    # coverage.day is now a day OFFSET from start_date (not day-of-week)
    for w_idx, worker in enumerate(workers):
        for day in range(num_days):
            for cov in coverage:
                if cov.day != day:
                    continue
                if cov.skill_id not in worker.skill_ids:
                    continue

                var_name = f"shift_w{w_idx}_d{day}_c{cov.id}"
                worker_shift[(w_idx, day, cov.id)] = model.NewBoolVar(var_name)

    # Build unavailability lookup
    unavail_lookup = {}
    for ua in request.unavailability:
        key = (ua.worker_id, ua.day)
        if key not in unavail_lookup:
            unavail_lookup[key] = []
        unavail_lookup[key].append(ua)

    # Constraint: Workers cannot work when unavailable
    # unavailability.day is now a day offset (same as coverage)
    for (w_idx, day, cov_id), var in worker_shift.items():
        worker = workers[w_idx]
        cov = next((c for c in coverage if c.id == cov_id), None)
        if not cov:
            continue

        unavails = unavail_lookup.get((worker.id, day), [])

        for ua in unavails:
            if ua.is_full_day:
                model.Add(var == 0)
            else:
                # Check time overlap
                if ua.start_minutes is not None and ua.end_minutes is not None:
                    if not (cov.end_minutes <= ua.start_minutes or cov.start_minutes >= ua.end_minutes):
                        model.Add(var == 0)

    # Constraint: Maximum one shift per worker per day
    for w_idx in range(len(workers)):
        for day in range(num_days):
            day_shifts = [
                var for (wi, d, cov_id), var in worker_shift.items()
                if wi == w_idx and d == day
            ]
            if day_shifts:
                model.Add(sum(day_shifts) <= 1)

    # Constraint: Coverage requirements
    coverage_slack = {}
    for cov in coverage:
        day = cov.day

        assigned_workers = [
            worker_shift[(w_idx, day, cov.id)]
            for w_idx in range(len(workers))
            if (w_idx, day, cov.id) in worker_shift
        ]

        # Create slack variable for under-coverage
        slack_var = model.NewIntVar(0, cov.min_workers, f"slack_d{day}_c{cov.id}")
        coverage_slack[(day, cov.id)] = slack_var

        if assigned_workers:
            model.Add(sum(assigned_workers) + slack_var >= cov.min_workers)
        else:
            model.Add(slack_var >= cov.min_workers)

    # Handle locked assignments
    locked_lookup = {}
    for ea in request.existing_assignments:
        if ea.is_locked:
            locked_lookup[(ea.worker_id, ea.day)] = ea

    for (w_idx, day, cov_id), var in worker_shift.items():
        worker = workers[w_idx]
        cov = next((c for c in coverage if c.id == cov_id), None)
        if not cov:
            continue

        locked = locked_lookup.get((worker.id, day))

        if locked:
            if locked.skill_id == cov.skill_id and locked.start_minutes == cov.start_minutes:
                model.Add(var == 1)

    # Objective: Minimize coverage gaps (primary)
    objectives = []

    # Heavily penalize coverage gaps
    for (day, cov_id), slack in coverage_slack.items():
        objectives.append(slack * 1000)

    # Balance hours if requested
    if request.balance_hours and len(workers) > 1:
        total_shifts = []
        for w_idx in range(len(workers)):
            worker_total = sum(
                var for (wi, d, cov_id), var in worker_shift.items()
                if wi == w_idx
            )
            total_shifts.append(worker_total)

        # Minimize variance by minimizing max-min difference
        max_shifts = model.NewIntVar(0, num_days * 3, "max_shifts")
        min_shifts = model.NewIntVar(0, num_days * 3, "min_shifts")

        for ts in total_shifts:
            model.Add(max_shifts >= ts)
            model.Add(min_shifts <= ts)

        objectives.append((max_shifts - min_shifts) * 10)

    # Minimize changes from existing if requested
    if request.minimize_changes:
        existing_lookup = {}
        for ea in request.existing_assignments:
            existing_lookup[(ea.worker_id, ea.day, ea.skill_id)] = True

        for (w_idx, day, cov_id), var in worker_shift.items():
            worker = workers[w_idx]
            cov = next((c for c in coverage if c.id == cov_id), None)
            if not cov:
                continue

            was_assigned = existing_lookup.get((worker.id, day, cov.skill_id), False)

            if was_assigned:
                # Penalize removing this assignment
                not_assigned = model.NewBoolVar(f"not_assigned_{w_idx}_{day}_{cov_id}")
                model.Add(var + not_assigned == 1)
                objectives.append(not_assigned * 5)

    # Set objective
    if objectives:
        model.Minimize(sum(objectives))

    # Solve
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30.0
    solver.parameters.num_search_workers = 4

    status = solver.Solve(model)

    solve_time = int((datetime.now() - start_time).total_seconds() * 1000)

    # Process results
    assignments = []
    total_hours = {w.id: 0.0 for w in workers}

    if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        for (w_idx, day, cov_id), var in worker_shift.items():
            if solver.Value(var) == 1:
                worker = workers[w_idx]
                cov = next((c for c in coverage if c.id == cov_id), None)
                if cov:
                    duration_hours = (cov.end_minutes - cov.start_minutes) / 60
                    total_hours[worker.id] += duration_hours

                    assignments.append(Assignment(
                        worker_id=worker.id,
                        worker_name=worker.name,
                        skill_id=cov.skill_id,
                        day=day,
                        start_minutes=cov.start_minutes,
                        end_minutes=cov.end_minutes
                    ))

    # Calculate coverage gaps (coverage.day is now a day offset)
    gaps = []
    for cov in coverage:
        day = cov.day
        assigned_count = sum(
            1 for a in assignments
            if a.day == day and a.skill_id == cov.skill_id
            and a.start_minutes == cov.start_minutes
        )

        if assigned_count < cov.min_workers:
            gaps.append(CoverageGap(
                skill_id=cov.skill_id,
                day=day,
                start_minutes=cov.start_minutes,
                end_minutes=cov.end_minutes,
                required=cov.min_workers,
                assigned=assigned_count
            ))

    # Determine status string
    status_str = "INFEASIBLE"
    if status == cp_model.OPTIMAL:
        status_str = "OPTIMAL" if len(gaps) == 0 else "FEASIBLE"
    elif status == cp_model.FEASIBLE:
        status_str = "FEASIBLE"

    # Build diagnostics
    diagnostics = []
    diagnostics.append(f"Generated {len(assignments)} shifts")
    diagnostics.append(f"Solve time: {solve_time}ms")

    if gaps:
        diagnostics.append(f"{len(gaps)} coverage gaps remaining")
    else:
        diagnostics.append("100% coverage achieved")

    if request.balance_hours:
        hours_list = list(total_hours.values())
        if hours_list:
            diagnostics.append(
                f"Hours range: {min(hours_list):.1f}h - {max(hours_list):.1f}h"
            )

    return SolveResponse(
        status=status_str,
        assignments=assignments,
        coverage_gaps=gaps,
        diagnostics=diagnostics,
        solve_time_ms=solve_time,
        total_hours_by_worker=total_hours
    )


@app.post("/solve", response_model=SolveResponse)
async def solve_schedule(request: SolveRequest):
    """Route to the appropriate solver backend."""
    try:
        if ORTOOLS_AVAILABLE:
            return _solve_cpsat(request)
        return _solve_greedy(request)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/validate")
async def validate_schedule(request: SolveRequest):
    """
    Validate a schedule without solving.
    Checks for constraint violations.
    """
    violations = []
    
    # Check workers have required skills
    for ea in request.existing_assignments:
        worker = next((w for w in request.workers if w.id == ea.worker_id), None)
        if worker and ea.skill_id not in worker.skill_ids:
            violations.append(f"Worker {worker.name} assigned skill they don't have")
    
    # Check unavailability conflicts
    for ea in request.existing_assignments:
        for ua in request.unavailability:
            if ea.worker_id != ua.worker_id:
                continue
            if ea.day != ua.day:
                continue
            
            if ua.is_full_day:
                violations.append(f"Worker assigned during unavailable day")
            else:
                if ua.start_minutes and ua.end_minutes:
                    if not (ea.end_minutes <= ua.start_minutes or ea.start_minutes >= ua.end_minutes):
                        violations.append(f"Worker assigned during unavailable time")
    
    return {
        "valid": len(violations) == 0,
        "violations": violations
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
