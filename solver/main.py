"""
Clocked Schedule Solver Service — v2 (Flexible Shift Model)

Coverage windows define slot-level staffing DEMAND only; a single worker
shift may span across multiple windows. Solver freely picks shift
start/end within [min_shift_minutes, max_shift_minutes] bounds.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

ORTOOLS_AVAILABLE = False
try:
    from ortools.sat.python import cp_model
    ORTOOLS_AVAILABLE = True
    print("[solver-v2] OR-Tools loaded — using CP-SAT solver")
except (ImportError, OSError) as e:
    print(f"[solver-v2] OR-Tools unavailable ({e}) — using greedy fallback")

app = FastAPI(title="Clocked Solver v2", version="2.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)


# ── Models ────────────────────────────────────────────────────────────────────

class Worker(BaseModel):
    id: str
    name: str
    skill_ids: list[str]
    place_ids: list[str]
    skill_ratings: dict[str, int] = {}
    start_date: Optional[str] = None


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
    min_hours_per_block: float = 2.0
    max_hours_per_block: float = 12.0
    soft_min_hours_per_block: float | None = None
    soft_max_hours_per_block: float | None = None
    min_rest_between_shifts: float = 8.0
    granularity_minutes: int = 15


class SolveRequest(BaseModel):
    place_id: str
    start_date: str
    end_date: str
    workers: list[Worker]
    coverage_windows: list[CoverageWindow]
    existing_assignments: list[ExistingAssignment] = []
    unavailability: list[Unavailability] = []
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


class CoverageGap(BaseModel):
    skill_id: str
    day: int
    start_minutes: int
    end_minutes: int
    required: int
    assigned: int


class SolveResponse(BaseModel):
    status: str
    assignments: list[Assignment]
    coverage_gaps: list[CoverageGap]
    diagnostics: list[str]
    solve_time_ms: int
    total_hours_by_worker: dict[str, float]


# ── Shared helpers ─────────────────────────────────────────────────────────────

def _is_shift_available(worker_id: str, day: int, start_min: int, end_min: int,
                         unavail_lookup: dict) -> bool:
    """True if shift [start_min, end_min) does not overlap any unavailability."""
    for ua in unavail_lookup.get((worker_id, day), []):
        if ua.is_full_day:
            return False
        if ua.start_minutes is not None and ua.end_minutes is not None:
            if not (end_min <= ua.start_minutes or start_min >= ua.end_minutes):
                return False
    return True


def _build_demand(coverage: list, granularity: int):
    """
    Returns:
      demand  : {(day, skill_id, slot): required_workers}
      extent  : {(day, skill_id): (first_slot, last_slot_exclusive)}
    """
    demand: dict = {}
    extent: dict = {}
    for cov in coverage:
        s = cov.start_minutes // granularity
        e = cov.end_minutes // granularity
        k = (cov.day, cov.skill_id)
        cur = extent.get(k)
        extent[k] = (min(cur[0], s), max(cur[1], e)) if cur else (s, e)
        for t in range(s, e):
            key = (cov.day, cov.skill_id, t)
            demand[key] = demand.get(key, 0) + cov.min_workers
    return demand, extent


def _coverage_gaps(coverage_windows: list, assignments: list,
                   remaining_demand: dict, granularity: int) -> list[CoverageGap]:
    gaps = []
    for cov in coverage_windows:
        cs = cov.start_minutes // granularity
        ce = cov.end_minutes // granularity
        gap_start = None
        for t in range(cs, ce + 1):
            has_gap = t < ce and remaining_demand.get((cov.day, cov.skill_id, t), 0) > 0
            if has_gap and gap_start is None:
                gap_start = t
            elif not has_gap and gap_start is not None:
                g_s = gap_start * granularity
                g_e = t * granularity
                ac = sum(1 for a in assignments
                         if a.day == cov.day and a.skill_id == cov.skill_id
                         and a.start_minutes < g_e and a.end_minutes > g_s)
                gaps.append(CoverageGap(
                    skill_id=cov.skill_id, day=cov.day,
                    start_minutes=g_s, end_minutes=g_e,
                    required=cov.min_workers, assigned=ac,
                ))
                gap_start = None
    return gaps


# ── Greedy solver ──────────────────────────────────────────────────────────────

def _solve_greedy(request: SolveRequest) -> SolveResponse:
    """
    Pure-Python greedy fallback (no OR-Tools).
    Treats coverage windows as slot-demand; assigns the longest valid shift
    that covers the most uncovered demand slots per worker/day/skill.
    """
    t0 = datetime.now()
    start = datetime.fromisoformat(request.start_date).date()
    end   = datetime.fromisoformat(request.end_date).date()
    num_days = (end - start).days + 1
    if num_days <= 0 or num_days > 31:
        raise HTTPException(status_code=400, detail="Invalid date range (1-31 days)")

    g         = request.settings.granularity_minutes
    min_slots = max(1, (request.settings.min_hours_per_block * 60) // g)
    max_slots = max(min_slots, (request.settings.max_hours_per_block * 60) // g)
    spd       = 24 * 60 // g  # slots per day

    unavail: dict = {}
    for ua in request.unavailability:
        unavail.setdefault((ua.worker_id, ua.day), []).append(ua)

    demand, extent = _build_demand(request.coverage_windows, g)
    remaining       = dict(demand)
    assigned_days: dict = {w.id: set() for w in request.workers}
    total_hours:   dict = {w.id: 0.0   for w in request.workers}
    assignments:   list = []
    max_total = request.settings.max_hours_per_day * num_days

    # Process day/skill pairs ordered by total demand (hardest first)
    day_skills = sorted(
        set((d, sk) for (d, sk, _) in demand),
        key=lambda ds: -sum(demand.get((ds[0], ds[1], t), 0) for t in range(spd))
    )

    for day, skill_id in day_skills:
        ext = extent.get((day, skill_id))
        if not ext:
            continue
        d_s, d_e = ext  # demand slot range

        eligible = sorted(
            [w for w in request.workers
             if skill_id in w.skill_ids and day not in assigned_days[w.id]],
            key=lambda w: (total_hours[w.id], -w.skill_ratings.get(skill_id, 3))
        )

        for worker in eligible:
            if not any(remaining.get((day, skill_id, t), 0) > 0 for t in range(d_s, d_e)):
                break
            if total_hours[worker.id] + min_slots * g / 60 > max_total:
                continue

            best, best_score = None, -1
            demand_len = d_e - d_s
            if demand_len >= min_slots:
                eff_max = min(max_slots, demand_len)
                s_start, e_limit = d_s, d_e
            else:
                eff_max = min_slots
                pad = (min_slots - demand_len + 1) // 2
                s_start = max(0, d_s - pad)
                e_limit = s_start + min_slots
            for length in range(eff_max, min_slots - 1, -1):
                for s in range(s_start, max(s_start, e_limit - length) + 1):
                    e = s + length
                    if e > e_limit:
                        continue
                    if not _is_shift_available(worker.id, day, s * g, e * g, unavail):
                        continue
                    cov_score = sum(min(remaining.get((day, skill_id, t), 0), 1) for t in range(s, e)) * 100000
                    overtime = max(0, length - soft_max_slots)
                    undertime = max(0, soft_min_slots - length)
                    score = cov_score + min(length, soft_max_slots) - (overtime * overtime * 100) - (undertime * undertime * 100)
                    if score > best_score:
                        best_score, best = score, (s, e)

            if best is None or best_score <= 0:
                continue

            s, e = best
            for t in range(s, e):
                k = (day, skill_id, t)
                if k in remaining:
                    remaining[k] = max(0, remaining[k] - 1)
            hours = (e - s) * g / 60
            total_hours[worker.id] += hours
            assigned_days[worker.id].add(day)
            assignments.append(Assignment(
                worker_id=worker.id, worker_name=worker.name,
                skill_id=skill_id, day=day,
                start_minutes=s * g, end_minutes=e * g,
            ))

    gaps      = _coverage_gaps(request.coverage_windows, assignments, remaining, g)
    solve_ms  = int((datetime.now() - t0).total_seconds() * 1000)
    status    = "OPTIMAL" if not gaps else ("FEASIBLE" if assignments else "INFEASIBLE")
    h         = [v for v in total_hours.values() if v > 0]
    diag      = [
        f"Generated {len(assignments)} shifts (greedy)", f"Solve time: {solve_ms}ms",
        "100% coverage achieved" if not gaps else f"{len(gaps)} coverage gaps remaining",
    ]
    if h:
        diag.append(f"Hours range: {min(h):.1f}h – {max(h):.1f}h")
    return SolveResponse(status=status, assignments=assignments, coverage_gaps=gaps,
                         diagnostics=diag, solve_time_ms=solve_ms,
                         total_hours_by_worker=total_hours)


# ── CP-SAT solver ──────────────────────────────────────────────────────────────

def _solve_cpsat(request: SolveRequest) -> SolveResponse:
    """
    CP-SAT solver v2 — flexible shift model.

    Shifts are free to start/end anywhere within worker availability;
    coverage windows are treated as slot-level demand requirements only.

    Hard constraints:
    - Max 1 shift per worker per day (shift may span multiple windows)
    - Shift duration in [min_hours_per_block*60, max_hours_per_block*60]
    - Shift must not overlap any worker unavailability
    - Locked existing assignments are pinned to their exact times

    Soft objectives (priority, highest first):
    - P1 (×100000): Minimize coverage gap (unfilled demand slots)
    - P2 (×50):     Balance assigned hours proportional to worker availability
    - P3:           Prefer longer shifts up to soft_max, penalize soft_min/soft_max violations
    - P4 (×5):    Minimise changes vs existing (repair mode only)
    """
    t0 = datetime.now()
    start    = datetime.fromisoformat(request.start_date).date()
    end      = datetime.fromisoformat(request.end_date).date()
    num_days = (end - start).days + 1
    if num_days <= 0 or num_days > 31:
        raise HTTPException(status_code=400, detail="Invalid date range (1-31 days)")

    g         = int(request.settings.granularity_minutes)
    min_slots = int(max(1, (request.settings.min_hours_per_block * 60) // g))
    max_slots = int(max(min_slots, (request.settings.max_hours_per_block * 60) // g))
    soft_min  = request.settings.soft_min_hours_per_block
    soft_max  = request.settings.soft_max_hours_per_block
    soft_min_slots = int(max(min_slots, (soft_min * 60) // g)) if soft_min else min_slots
    soft_max_slots = int(max(min_slots, (soft_max * 60) // g)) if soft_max else max_slots
    spd       = int(24 * 60 // g)
    workers   = request.workers
    model     = cp_model.CpModel()

    demand, extent = _build_demand(request.coverage_windows, g)

    unavail: dict = {}
    for ua in request.unavailability:
        unavail.setdefault((ua.worker_id, ua.day), []).append(ua)

    # ── Generate candidate shift variables ────────────────────────────────────
    shift_vars: dict = {}  # (w_idx, day, skill_id, s, e) -> BoolVar

    for w_idx, worker in enumerate(workers):
        for day in range(num_days):
            for skill_id in worker.skill_ids:
                ext = extent.get((day, skill_id))
                if not ext:
                    continue
                d_s, d_e = ext
                demand_len = d_e - d_s
                # Shifts must stay within demand extent
                if demand_len >= min_slots:
                    s_lo = d_s
                    s_hi = d_e - min_slots
                    e_cap = d_e
                else:
                    pad = (min_slots - demand_len + 1) // 2
                    s_lo = max(0, d_s - pad)
                    s_hi = s_lo
                    e_cap = s_lo + min_slots
                for s in range(s_lo, s_hi + 1):
                    for e in range(s + min_slots, min(s + max_slots, e_cap) + 1):
                        if not _is_shift_available(worker.id, day, s * g, e * g, unavail):
                            continue
                        shift_vars[(w_idx, day, skill_id, s, e)] = model.NewBoolVar(
                            f"x{w_idx}_{day}_{s}_{e}"
                        )

    # Build lookup indices for fast constraint building
    # slot -> covering vars
    slot_vars: dict = {}
    # (w_idx, day) -> all vars for that worker-day
    wd_vars: dict = {}
    for (w_idx, day, skill_id, s, e), var in shift_vars.items():
        wd_vars.setdefault((w_idx, day), []).append(var)
        for t in range(s, e):
            slot_vars.setdefault((day, skill_id, t), []).append(var)

    # ── Hard: one shift per worker per day ────────────────────────────────────
    for (w_idx, day), dvars in wd_vars.items():
        if dvars:
            model.Add(sum(dvars) <= 1)

    # ── Coverage constraints with slack ───────────────────────────────────────
    slack_vars: dict = {}
    for (day, skill_id, t), req in demand.items():
        covering = slot_vars.get((day, skill_id, t), [])
        slack = model.NewIntVar(0, req, f"sl{day}_{t}")
        slack_vars[(day, skill_id, t)] = slack
        model.Add((sum(covering) if covering else 0) + slack >= req)

    # ── Locked existing assignments ───────────────────────────────────────────
    w_id_to_idx = {w.id: i for i, w in enumerate(workers)}
    for ea in request.existing_assignments:
        if not ea.is_locked:
            continue
        w_idx = w_id_to_idx.get(ea.worker_id)
        if w_idx is None:
            continue
        key = (w_idx, ea.day, ea.skill_id,
               ea.start_minutes // g, ea.end_minutes // g)
        if key in shift_vars:
            model.Add(shift_vars[key] == 1)

    # ── Objectives ────────────────────────────────────────────────────────────
    objectives = []

    # P1: Coverage gap penalty
    for slack in slack_vars.values():
        objectives.append(slack * 100000)

    # P2: Balance hours proportional to availability
    if request.balance_hours and len(workers) > 1:
        avail_slots_w = []
        for worker in workers:
            total = 0
            for day in range(num_days):
                uas = unavail.get((worker.id, day), [])
                if any(ua.is_full_day for ua in uas):
                    continue
                day_avail = spd
                for ua in uas:
                    if not ua.is_full_day and ua.start_minutes is not None:
                        day_avail -= (ua.end_minutes - ua.start_minutes) // g
                total += max(0, day_avail)
            avail_slots_w.append(total)

        total_avail = sum(avail_slots_w)
        total_demand = sum(demand.values())

        if total_avail > 0:
            for w_idx in range(len(workers)):
                w_vars = [(s, e, v) for (wi, d, sk, s, e), v in shift_vars.items()
                          if wi == w_idx]
                if not w_vars:
                    continue
                assigned_expr = sum((e - s) * v for s, e, v in w_vars)
                target = (total_demand * avail_slots_w[w_idx]) // total_avail
                dev = model.NewIntVar(0, num_days * spd, f"dev{w_idx}")
                model.Add(dev >= assigned_expr - target)
                model.Add(dev >= target - assigned_expr)
                objectives.append(dev * 50)

    # P3: Prefer longer shifts (penalise shortfall from demand length, bounded by soft_max_slots)
    # Also heavily penalise shifts extending beyond soft_max_slots
    for (w_idx, day, skill_id, s, e), var in shift_vars.items():
        length = e - s
        demand_range = extent.get((day, skill_id), (s, e))
        useful_max = min(soft_max_slots, demand_range[1] - demand_range[0])
        
        # Penalise shortfall to encourage combining shifts up to soft_max,
        # using a quadratic penalty to naturally balance shift lengths (enforcing FIFO)
        shortfall = useful_max - length
        if shortfall > 0:
            objectives.append(var * (shortfall * shortfall * 5))
            
        # Heavily penalise shifts exceeding soft_max (quadratic overtime penalty)
        if length > soft_max_slots:
            overtime = length - soft_max_slots
            objectives.append(var * (overtime * overtime * 100))

        # Heavily penalise shifts under soft_min (quadratic undertime penalty)
        if length < soft_min_slots:
            undertime = soft_min_slots - length
            objectives.append(var * (undertime * undertime * 100))

    # P4: Minimise changes (repair mode)
    if request.minimize_changes:
        for ea in request.existing_assignments:
            if ea.is_locked:
                continue
            w_idx = w_id_to_idx.get(ea.worker_id)
            if w_idx is None:
                continue
            key = (w_idx, ea.day, ea.skill_id,
                   ea.start_minutes // g, ea.end_minutes // g)
            if key not in shift_vars:
                continue
            removed = model.NewBoolVar(f"rm{w_idx}_{ea.day}")
            model.Add(shift_vars[key] + removed == 1)
            objectives.append(removed * 5)

    if objectives:
        model.Minimize(sum(objectives))

    # ── Solve ─────────────────────────────────────────────────────────────────
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = request.solver_timeout_seconds
    solver.parameters.num_search_workers  = 4
    status = solver.Solve(model)
    solve_ms = int((datetime.now() - t0).total_seconds() * 1000)

    # ── Extract assignments ───────────────────────────────────────────────────
    assignments: list = []
    total_hours: dict = {w.id: 0.0 for w in workers}

    if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        for (w_idx, day, skill_id, s, e), var in shift_vars.items():
            if solver.Value(var) == 1:
                worker = workers[w_idx]
                hours  = (e - s) * g / 60
                total_hours[worker.id] += hours
                assignments.append(Assignment(
                    worker_id=worker.id, worker_name=worker.name,
                    skill_id=skill_id, day=day,
                    start_minutes=s * g, end_minutes=e * g,
                ))

    # ── Coverage gaps (from slack values) — report precise sub-ranges ──────
    gaps = []
    for cov in request.coverage_windows:
        cs, ce = cov.start_minutes // g, cov.end_minutes // g
        gap_start = None
        for t in range(cs, ce + 1):
            has_gap = False
            if t < ce:
                key = (cov.day, cov.skill_id, t)
                if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
                    has_gap = key in slack_vars and solver.Value(slack_vars[key]) > 0
                else:
                    has_gap = True
            if has_gap and gap_start is None:
                gap_start = t
            elif not has_gap and gap_start is not None:
                g_s = gap_start * g
                g_e = t * g
                ac = sum(1 for a in assignments
                         if a.day == cov.day and a.skill_id == cov.skill_id
                         and a.start_minutes < g_e and a.end_minutes > g_s)
                gaps.append(CoverageGap(
                    skill_id=cov.skill_id, day=cov.day,
                    start_minutes=g_s, end_minutes=g_e,
                    required=cov.min_workers, assigned=ac,
                ))
                gap_start = None

    status_str = "INFEASIBLE"
    if status == cp_model.OPTIMAL:
        status_str = "OPTIMAL" if not gaps else "FEASIBLE"
    elif status == cp_model.FEASIBLE:
        status_str = "FEASIBLE"

    h    = [v for v in total_hours.values()]
    diag = [
        f"Generated {len(assignments)} shifts (CP-SAT)", f"Solve time: {solve_ms}ms",
        "100% coverage achieved" if not gaps else f"{len(gaps)} coverage gaps remaining",
    ]
    if h:
        diag.append(f"Hours range: {min(h):.1f}h – {max(h):.1f}h")

    return SolveResponse(status=status_str, assignments=assignments, coverage_gaps=gaps,
                         diagnostics=diag, solve_time_ms=solve_ms,
                         total_hours_by_worker=total_hours)


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "clocked-solver-v2",
            "solver": "cpsat" if ORTOOLS_AVAILABLE else "greedy"}


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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Solver error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
