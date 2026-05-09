"""
Ziedonis Cafe — 2-Week Schedule Test (2026-04-27 → 2026-05-10)

Calls the solver with the Ziedonis scenario and produces
`ziedonis_report.html`:

  1. Exec summary stat tiles (coverage %, hours, gaps, shifts, pinned)
  2. Key assumptions block (for client sanity-check)
  3. Gap / understaffing banner with plain-language explanation
  4. Case summary (hours, settings, workers, contracts)
  5. 2-week calendar overview (closed days rendered distinctly)
  6. Weekly schedule grid (workers × 14 days — printable)
  7. Hour targets table with week-1 / week-2 split
  8. Per-day Gantt charts with worker bars, pinned-shift markers, gap indicators
  9. Solver diagnostics + raw violations / gaps

Run:   python run_test.py
Open:  solver/tests/ziedonis/ziedonis_report.html

Requires the solver running at http://localhost:8000.
"""

import requests
import webbrowser
from datetime import timedelta
from pathlib import Path
from collections import defaultdict

from scenario import (
    START, NUM_DAYS, PLACE_ID, CLOSED_WEEKDAYS,
    DAY_NAMES, DAY_SHORT,
    WORKER_ORDER, WORKER_NAMES, WORKER_COLORS, WORKER_ROLE_LABEL,
    CONTRACTS, SKILL_RATINGS, WORKER_FLAGS,
    SKILL_BAR, SKILL_WAITER,
    SETTINGS,
    weekday, day_date, build_scenario,
)

SOLVER_URL = "http://localhost:8000"


# ── helpers ──────────────────────────────────────────────────────────────────

def mins_to_time(m):
    return f"{int(m) // 60:02d}:{int(m) % 60:02d}"


def fmt_date(d: int) -> str:
    dt = day_date(d)
    return f"{dt.day:02d}.{dt.month:02d}"


def _group_day_ranges(days):
    if not days:
        return []
    sorted_days = sorted(set(days))
    ranges = []
    start = sorted_days[0]
    end = sorted_days[0]
    for d in sorted_days[1:]:
        if d == end + 1:
            end = d
        else:
            ranges.append((start, end))
            start = d
            end = d
    ranges.append((start, end))
    result = []
    for s, e in ranges:
        ds = day_date(s)
        de = day_date(e)
        if s == e:
            result.append(f"Off {ds.day:02d}.{ds.month:02d}")
        else:
            result.append(f"Off {ds.day:02d}.{ds.month:02d}–{de.day:02d}.{de.month:02d}")
    return result


# ── Gap / understaffing explanation ──────────────────────────────────────────
#
# The solver reports one `CoverageGap` per coverage window that is not fully
# satisfied. With stacked windows (e.g. waiter baseline + peak) this can
# produce multiple redundant or misleading gap entries whose `assigned` count
# double-counts a single worker. We rebuild the understaffing picture from
# scratch by comparing stacked demand vs actual headcount at each slot.

def true_slot_shortage(scenario, assignments, granularity=30):
    """Return {(day, skill): [(start_min, end_min, short_by)]} contiguous runs."""
    # 1. Stacked demand per slot
    demand = defaultdict(int)
    for c in scenario["coverage_windows"]:
        for slot in range(c["start_minutes"] // granularity, c["end_minutes"] // granularity):
            demand[(c["day"], c["skill_id"], slot)] += c["min_workers"]

    # 2. Assigned headcount per slot
    assigned = defaultdict(int)
    for a in assignments:
        for slot in range(a["start_minutes"] // granularity, a["end_minutes"] // granularity):
            assigned[(a["day"], a["skill_id"], slot)] += 1

    # 3. Collect short slots
    shortages = defaultdict(list)   # (day, skill) → list of (slot, short_by)
    for key, need in demand.items():
        have = assigned.get(key, 0)
        if have < need:
            day, skill, slot = key
            shortages[(day, skill)].append((slot, need - have))

    # 4. Collapse into contiguous (start, end, short_by) runs
    out = defaultdict(list)
    for (day, skill), slots in shortages.items():
        slots.sort()
        run_start = slots[0][0]
        run_short = slots[0][1]
        prev_slot = slots[0][0]
        for slot, short_by in slots[1:]:
            if slot == prev_slot + 1 and short_by == run_short:
                prev_slot = slot
            else:
                out[(day, skill)].append(
                    (run_start * granularity, (prev_slot + 1) * granularity, run_short)
                )
                run_start = slot
                run_short = short_by
                prev_slot = slot
        out[(day, skill)].append(
            (run_start * granularity, (prev_slot + 1) * granularity, run_short)
        )
    return out


def explain_shortages(shortages, scenario):
    """Convert shortage runs into human-readable reason strings."""
    unavails = scenario["unavailability"]
    workers = scenario["workers"]

    skill_workers = defaultdict(list)
    for w in workers:
        for sk in w["skill_ids"]:
            skill_workers[sk].append(w["id"])

    ua_map = defaultdict(list)
    for u in unavails:
        ua_map[(u["worker_id"], u["day"])].append(u)

    out = []
    for (day, skill), runs in shortages.items():
        for sm, em, short_by in runs:
            unavailable_workers = []
            available_workers = []
            for wid in skill_workers[skill]:
                uas = ua_map.get((wid, day), [])
                full_day_off = any(u.get("is_full_day") for u in uas)
                partial_blocks = False
                for u in uas:
                    if u.get("is_full_day"):
                        continue
                    us, ue = u.get("start_minutes", 0), u.get("end_minutes", 0)
                    if us < em and ue > sm:
                        partial_blocks = True
                        break
                if full_day_off:
                    unavailable_workers.append(f"{WORKER_NAMES[wid]} (full day off)")
                elif partial_blocks:
                    unavailable_workers.append(f"{WORKER_NAMES[wid]} (unavailable this window)")
                else:
                    available_workers.append(WORKER_NAMES[wid])

            reason_parts = []
            if unavailable_workers:
                reason_parts.append("Unavailable: " + ", ".join(unavailable_workers))
            if available_workers:
                reason_parts.append("Available: " + ", ".join(available_workers))
            reason = "  ·  ".join(reason_parts)

            out.append({
                "day": day,
                "skill": skill,
                "window": f"{mins_to_time(sm)}–{mins_to_time(em)}",
                "short_by": short_by,
                "duration_hours": (em - sm) / 60,
                "reason": reason,
            })
    return out


# ── Weekly grid builder ──────────────────────────────────────────────────────

def build_weekly_grid(scenario, assignments):
    """Return dict {worker_id: {day: cell_str or 'OFF' or 'CLOSED' or ''}}."""
    ua_map = defaultdict(list)
    for u in scenario["unavailability"]:
        ua_map[(u["worker_id"], u["day"])].append(u)

    # assignments indexed by (worker_id, day)
    a_map = defaultdict(list)
    for a in assignments:
        a_map[(a["worker_id"], a["day"])].append(a)

    grid = {}
    for wid in WORKER_ORDER:
        row = {}
        for d in range(NUM_DAYS):
            wd = weekday(d)
            if wd in CLOSED_WEEKDAYS:
                row[d] = {"kind": "closed"}
                continue
            shifts = a_map.get((wid, d), [])
            if shifts:
                shifts.sort(key=lambda x: x["start_minutes"])
                parts = []
                for a in shifts:
                    parts.append(
                        f"{mins_to_time(a['start_minutes'])}–{mins_to_time(a['end_minutes'])}"
                    )
                row[d] = {"kind": "shift", "text": " / ".join(parts),
                          "locked": any(a.get("is_locked") for a in shifts),
                          "skill": shifts[0]["skill_id"]}
                continue
            # Off? Check unavailability
            uas = ua_map.get((wid, d), [])
            if any(u.get("is_full_day") for u in uas):
                row[d] = {"kind": "off"}
            elif uas:
                # Partial unavail but no shift => effectively not scheduled
                row[d] = {"kind": "partial-off"}
            else:
                row[d] = {"kind": "free"}
        grid[wid] = row
    return grid


# ── HTML head / styles ──────────────────────────────────────────────────────

HTML_HEAD = """<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ziedonis Cafe — 2-Week Schedule Report</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
     background:#fff;color:#1a1a1a;line-height:1.5}

/* Header */
.report-header{padding:36px 48px 20px;border-bottom:1px solid #e5e5e5}
.report-header h1{font-size:26px;font-weight:700}
.report-header .sub{color:#888;font-size:13px;margin-top:4px}
.status-pill{display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;
  font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-left:8px}
.status-pill.ok{background:#dcfce7;color:#166534}
.status-pill.warn{background:#fef3c7;color:#92400e}
.status-pill.bad{background:#fee2e2;color:#991b1b}

/* Stat tiles */
.stat-strip{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;padding:20px 48px;
  border-bottom:1px solid #f0f0f0;background:#fafafa}
@media(max-width:900px){.stat-strip{grid-template-columns:repeat(3,1fr)}}
.stat-tile{background:#fff;border:1px solid #eee;border-radius:8px;padding:14px 16px}
.stat-tile .label{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.04em;font-weight:600}
.stat-tile .value{font-size:22px;font-weight:700;color:#111;margin-top:4px}
.stat-tile .value.ok{color:#16a34a}
.stat-tile .value.warn{color:#d97706}
.stat-tile .value.bad{color:#dc2626}
.stat-tile .hint{font-size:11px;color:#aaa;margin-top:2px}

/* Sections */
.section{padding:28px 48px}
.section h2{font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#333;
  margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid #eee}
.section h3{font-size:14px;font-weight:700;color:#444;margin-bottom:10px}
.section p.sub{color:#888;font-size:13px}

/* Gap banner */
.gap-banner{margin:0 48px 0;padding:18px 20px;border-radius:10px;background:#fff7ed;
  border:1px solid #fdba74;border-left:4px solid #ea580c}
.gap-banner h2{font-size:15px;font-weight:700;color:#9a3412;margin-bottom:6px;letter-spacing:0;text-transform:none;border:none;padding:0}
.gap-banner .intro{font-size:13px;color:#7c2d12;margin-bottom:12px}
.gap-banner ul{list-style:none;padding:0;margin:0}
.gap-banner li{padding:10px 12px;background:#fff;border:1px solid #fed7aa;border-radius:6px;margin-bottom:6px;font-size:13px}
.gap-banner li strong{color:#9a3412}
.gap-banner li .reason{color:#7c2d12;font-size:12px;margin-top:4px;display:block}

/* Info banner (assumptions) */
.info-banner{margin:0 48px;padding:18px 20px;border-radius:10px;background:#eff6ff;
  border:1px solid #bfdbfe;border-left:4px solid #3b82f6}
.info-banner h2{font-size:15px;font-weight:700;color:#1e3a8a;margin-bottom:10px;letter-spacing:0;text-transform:none;border:none;padding:0}
.info-banner ul{list-style:none;padding:0;margin:0}
.info-banner li{padding:5px 0;font-size:13px;color:#1e3a8a}
.info-banner li::before{content:"• ";color:#3b82f6;font-weight:700}
.info-banner li strong{color:#1e40af}

/* Grid (case summary) */
.case-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px}
@media(max-width:900px){.case-grid{grid-template-columns:1fr}}
.req-card{background:#fafafa;border:1px solid #eee;border-radius:8px;padding:16px}
.req-card h4{font-size:13px;font-weight:700;color:#444;margin-bottom:8px}

/* Tables */
.data-table{width:100%;border-collapse:collapse;font-size:13px}
.data-table th{text-align:left;padding:8px 12px;background:#f8f8f8;color:#555;
  font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.04em;
  border-bottom:2px solid #eee}
.data-table td{padding:8px 12px;border-bottom:1px solid #f0f0f0;vertical-align:top}
.data-table.compact td,.data-table.compact th{padding:6px 10px}
.data-table tbody tr:hover{background:#fafafa}
.center{text-align:center}
.total-row td{background:#f8f8f8;border-top:2px solid #ddd;font-weight:700}
.constraint-cell{font-size:12px;color:#666}

/* Dots & chips */
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:middle}
.avail-ok{color:#16a34a}

/* Delta coloring */
.delta-ok{color:#16a34a;font-weight:600}
.delta-warn{color:#d97706;font-weight:600}
.delta-bad{color:#dc2626;font-weight:600}

/* Bars */
.bar-cell{width:180px}
.bar{height:16px;border-radius:3px;min-width:4px}

/* Weekly schedule grid */
.weekgrid-wrap{overflow-x:auto;background:#fff;border:1px solid #eee;border-radius:8px}
.weekgrid{width:100%;border-collapse:collapse;font-size:12px}
.weekgrid th,.weekgrid td{border:1px solid #eee;padding:8px 8px;text-align:center;min-width:86px;vertical-align:middle}
.weekgrid th{background:#f8f8f8;color:#555;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.03em}
.weekgrid th.worker-col,.weekgrid td.worker-col{position:sticky;left:0;background:#fff;text-align:left;min-width:170px;z-index:1}
.weekgrid th.worker-col{background:#f8f8f8}
.weekgrid th.closed-col{background:#f1f5f9;color:#94a3b8}
.weekgrid th.weekend-col{background:#fef9c3}
.weekgrid td.cell-closed{background:#f8fafc;color:#94a3b8;font-style:italic}
.weekgrid td.cell-off{background:#fef2f2;color:#991b1b;font-weight:600}
.weekgrid td.cell-partial{background:#fffbeb;color:#92400e;font-size:11px}
.weekgrid td.cell-free{background:#f9fafb;color:#cbd5e1}
.weekgrid td.cell-shift{background:#ecfdf5;color:#065f46;font-weight:600;font-size:11px;line-height:1.35}
.weekgrid td.cell-shift .skill-label{display:block;font-size:9px;color:#047857;font-weight:500;text-transform:uppercase;letter-spacing:.05em;margin-top:2px}
.weekgrid td.cell-shift.pinned{background:#fef3c7;color:#78350f;border:2px solid #f59e0b}
.weekgrid td.cell-shift.pinned .lock{font-size:10px}
.weekgrid .w-name{font-weight:700;color:#111;font-size:13px}
.weekgrid .w-role{font-size:10px;color:#888;margin-top:2px}
.weekgrid .col-hours{background:#f8f8f8;font-weight:700;color:#111}

/* Week separator */
.weekgrid td.week-sep, .weekgrid th.week-sep{border-left:3px solid #cbd5e1}

/* Month-like grid (overview) */
.month-grid{max-width:780px}
.month-header{display:grid;grid-template-columns:repeat(7,1fr);text-align:center;font-size:12px;
  font-weight:700;color:#888;margin-bottom:6px}
.month-row{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px}
.day-cell{border-radius:8px;padding:8px 6px;text-align:center;text-decoration:none;display:flex;
  flex-direction:column;align-items:center;min-height:68px;justify-content:center;border:1px solid #eee;
  transition:transform .1s;color:inherit}
.day-cell:hover{transform:scale(1.05)}
.day-cell.empty{background:#fafafa;border-color:transparent}
.day-cell.ok{background:#f0fdf4;border-color:#bbf7d0;color:#166534}
.day-cell.gap{background:#fef2f2;border-color:#fecaca;color:#991b1b}
.day-cell.closed{background:#f1f5f9;border-color:#e2e8f0;color:#94a3b8}
.day-num{font-size:18px;font-weight:700;line-height:1}
.day-wd{font-size:10px;color:inherit;opacity:.7;margin-top:2px}
.gap-badge{font-size:10px;background:#fee2e2;color:#dc2626;border-radius:3px;padding:1px 5px;margin-top:3px}
.closed-badge{font-size:10px;background:#e2e8f0;color:#64748b;border-radius:3px;padding:1px 5px;margin-top:3px}

/* Day detail */
.day-detail{padding:20px 48px 28px;border-bottom:1px solid #f0f0f0}
.day-detail.day-gap{border-left:4px solid #fca5a5}
.day-detail.day-ok{border-left:4px solid #86efac}
.day-detail.day-closed{border-left:4px solid #cbd5e1;background:#fafafa}
.day-header{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.day-header h3{font-size:16px;font-weight:700;color:#111}
.day-gap-badge{font-size:12px;background:#fee2e2;color:#dc2626;border-radius:5px;padding:3px 10px;font-weight:600}
.day-ok-badge{font-size:12px;background:#dcfce7;color:#166534;border-radius:5px;padding:3px 10px;font-weight:600}
.day-closed-badge{font-size:12px;background:#e2e8f0;color:#64748b;border-radius:5px;padding:3px 10px;font-weight:600}

/* Availability row */
.avail-row{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.avail-chip{font-size:11px;padding:2px 8px;border-radius:4px;white-space:nowrap}
.avail-chip.on{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534}
.avail-chip.off{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}
.avail-chip.partial{background:#fffbeb;border:1px solid #fde68a;color:#92400e}

/* Gantt */
.gantt-wrap{position:relative;background:#fafafa;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden}
.gantt-role-group{display:flex;border-bottom:1px solid #f0f0f0}
.gantt-role-group:last-of-type{border-bottom:none}
.gantt-role-label{width:90px;min-width:90px;display:flex;align-items:center;justify-content:center;
  font-size:12px;font-weight:700;color:#555;background:#f5f5f5;border-right:1px solid #e5e5e5;
  padding:8px 4px;text-align:center}
.gantt-role-label-spacer{width:90px;min-width:90px}
.gantt-lanes{flex:1;position:relative;min-height:40px}
.gantt-demand{position:absolute;top:0;background:#f0f9ff;border-left:2px dashed #93c5fd;
  border-right:2px dashed #93c5fd;display:flex;align-items:flex-start;justify-content:center;
  padding-top:4px;z-index:0}
.demand-label{font-size:10px;color:#60a5fa;font-weight:600}
.gantt-bar{position:absolute;height:30px;border-radius:5px;display:flex;align-items:center;
  gap:6px;padding:0 8px;font-size:12px;white-space:nowrap;overflow:hidden;z-index:1}
.gantt-bar.pinned{outline:2px dashed #f59e0b;outline-offset:-2px}
.bar-lock{font-size:10px;color:#d97706}
.bar-name{font-weight:700;font-size:12px}
.bar-time{color:#666;font-size:11px}
.bar-dur{color:#888;font-size:11px;background:#f0f0f0;padding:1px 4px;border-radius:3px}
.gantt-gap{position:absolute;height:30px;border-radius:5px;display:flex;align-items:center;
  padding:0 8px;font-size:11px;background:#fef2f2;border:1px dashed #fca5a5;color:#dc2626;
  white-space:nowrap;z-index:1}
.gantt-axis{display:flex;border-top:1px solid #e5e5e5;background:#f5f5f5}
.gantt-time-labels{flex:1;position:relative;height:24px}
.tick{position:absolute;font-size:10px;color:#aaa;transform:translateX(-50%);top:4px;font-weight:500}

/* Legend */
.legend{display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:#666;margin-top:12px}
.legend .swatch{display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:middle;margin-right:5px}

/* Diagnostics */
.diag-list{list-style:none;padding:0}
.diag-list li{padding:4px 0;font-size:13px;color:#555}
.diag-list li::before{content:"→ ";color:#aaa}
.gap-row td{color:#dc2626}

@media print{
  .day-detail{break-inside:avoid}
  .gap-banner, .info-banner{break-inside:avoid}
}
</style>
</head><body>
"""


# ── HTML builder ─────────────────────────────────────────────────────────────

def build_html(scenario, response):
    assignments = response.get("assignments", [])
    gaps = response.get("coverage_gaps", [])
    hours = response.get("total_hours_by_worker", {})
    covs = scenario["coverage_windows"]
    unavails = scenario["unavailability"]
    workers = scenario["workers"]
    pins = scenario["existing_assignments"]
    violations = response.get("constraint_violations", [])

    # True slot-level shortage (authoritative — derived from demand vs assigned)
    shortages_by_key = true_slot_shortage(scenario, assignments)
    shortage_explanations = explain_shortages(shortages_by_key, scenario)

    # Per-day stats — use our authoritative shortages, not the solver's raw gaps.
    short_by_day = defaultdict(list)
    for s in shortage_explanations:
        short_by_day[s["day"]].append(s)

    day_info = {}
    for d in range(NUM_DAYS):
        wd = weekday(d)
        d_assigns = [a for a in assignments if a["day"] == d]
        d_shortages = short_by_day.get(d, [])
        d_covs = [c for c in covs if c["day"] == d]
        gap_mins = sum(int(s["duration_hours"] * 60) * s["short_by"] for s in d_shortages)
        is_closed = wd in CLOSED_WEEKDAYS
        day_info[d] = {
            "assigns": d_assigns, "shortages": d_shortages, "covs": d_covs,
            "gap_mins": gap_mins, "ok": len(d_shortages) == 0,
            "closed": is_closed,
        }

    ua_by_worker_day = {}
    for ua in unavails:
        ua_by_worker_day.setdefault((ua["worker_id"], ua["day"]), []).append(ua)

    # Total required worker-minutes (stacked)
    total_required_slot_mins = 0
    for c in covs:
        total_required_slot_mins += (c["end_minutes"] - c["start_minutes"]) * c["min_workers"]
    # Total missing worker-minutes from shortages
    gap_missing_worker_minutes = 0
    for s in shortage_explanations:
        gap_missing_worker_minutes += int(s["duration_hours"] * 60) * s["short_by"]
    covered_mins = total_required_slot_mins - gap_missing_worker_minutes
    coverage_pct = (covered_mins / total_required_slot_mins * 100) if total_required_slot_mins else 100

    total_hours = sum(hours.values())
    total_shifts = len(assignments)
    total_pinned = len(pins)
    # Gap days / hours derived from our authoritative shortage analysis
    num_gap_days = len({s["day"] for s in shortage_explanations})
    gap_hours = gap_missing_worker_minutes / 60

    status = response.get("status", "UNKNOWN")
    if status.upper() in ("OPTIMAL", "FEASIBLE"):
        status_cls = "ok" if num_gap_days == 0 else "warn"
    else:
        status_cls = "bad"

    # Build
    parts = [HTML_HEAD]

    # ── Header ────────────────────────────────────────────────────────────────
    end_date = (START + timedelta(days=NUM_DAYS - 1))
    parts.append('<div class="report-header">')
    parts.append(
        f'<h1>Ziedonis Cafe — 2-Week Schedule'
        f' <span class="status-pill {status_cls}">{status}</span></h1>'
    )
    parts.append(
        f'<p class="sub">{START.isoformat()} → {end_date.isoformat()}  ·  '
        f'{len(workers)} workers  ·  {len(covs)} coverage windows  ·  '
        f'solved in {response.get("solve_time_ms", "–")}ms</p>'
    )
    parts.append('</div>')

    # ── Exec summary tiles ────────────────────────────────────────────────────
    pct_cls = "ok" if coverage_pct >= 99.5 else ("warn" if coverage_pct >= 95 else "bad")
    gap_cls = "ok" if num_gap_days == 0 else "warn"
    parts.append('<div class="stat-strip">')
    parts.append(
        f'<div class="stat-tile"><div class="label">Coverage</div>'
        f'<div class="value {pct_cls}">{coverage_pct:.1f}%</div>'
        f'<div class="hint">of required worker-minutes</div></div>'
    )
    parts.append(
        f'<div class="stat-tile"><div class="label">Shifts</div>'
        f'<div class="value">{total_shifts}</div>'
        f'<div class="hint">{total_pinned} pinned</div></div>'
    )
    parts.append(
        f'<div class="stat-tile"><div class="label">Total hours</div>'
        f'<div class="value">{total_hours:.1f}h</div>'
        f'<div class="hint">across {len(workers)} workers</div></div>'
    )
    avg_per_worker = total_hours / len(workers) if workers else 0
    parts.append(
        f'<div class="stat-tile"><div class="label">Avg / worker</div>'
        f'<div class="value">{avg_per_worker:.1f}h</div>'
        f'<div class="hint">over 2 weeks</div></div>'
    )
    parts.append(
        f'<div class="stat-tile"><div class="label">Gap days</div>'
        f'<div class="value {gap_cls}">{num_gap_days}</div>'
        f'<div class="hint">{gap_hours:.1f}h total gap</div></div>'
    )
    open_days = sum(1 for d in range(NUM_DAYS) if weekday(d) not in CLOSED_WEEKDAYS)
    parts.append(
        f'<div class="stat-tile"><div class="label">Open days</div>'
        f'<div class="value">{open_days}</div>'
        f'<div class="hint">of {NUM_DAYS} in horizon</div></div>'
    )
    parts.append('</div>')

    # ── Understaffing banner ──────────────────────────────────────────────────
    if shortage_explanations:
        parts.append('<div class="section" style="padding-bottom:0"><div class="gap-banner">')
        parts.append('<h2>⚠ Understaffing Alerts</h2>')
        parts.append(
            f'<div class="intro">'
            f'<strong>{num_gap_days} day(s)</strong> have coverage shortfalls '
            f'(<strong>{gap_hours:.1f} worker-hours</strong> short in total). '
            f'Each entry below shows the time window where fewer workers are '
            f'scheduled than the combined (baseline + peak) coverage template '
            f'requires. Decide whether to bring in extra help, relax the peak '
            f'requirement, or accept the gap.'
            f'</div>'
        )
        parts.append('<ul>')
        for s in sorted(shortage_explanations, key=lambda x: (x["day"], x["window"])):
            dt = day_date(s["day"])
            parts.append(
                f'<li><strong>{DAY_NAMES[dt.weekday()]} {fmt_date(s["day"])}  ·  '
                f'{s["skill"]} {s["window"]}</strong> — '
                f'short by <strong>{s["short_by"]} worker</strong> for '
                f'<strong>{s["duration_hours"]:.1f}h</strong>.'
                f'<span class="reason">{s["reason"]}</span></li>'
            )
        parts.append('</ul></div></div>')

    # ── Key assumptions ───────────────────────────────────────────────────────
    parts.append('<div class="section" style="padding-bottom:0"><div class="info-banner">')
    parts.append('<h2>Key assumptions & pre-commitments</h2>')
    parts.append('<ul>')
    parts.append(
        '<li><strong>Peak window = 18:00–21:00</strong> every open day. '
        '1 extra waiter required on top of the quiet baseline during peak.</li>'
    )
    parts.append(
        '<li><strong>Head bartender arrives 14:30</strong> on weekdays (30 min pre-open prep). '
        'Weekend open 13:00 for everyone.</li>'
    )
    parts.append(
        '<li><strong>Pinned shifts:</strong> Robijs Bar 14:30–22:00 on Tue 28.04 and Tue 05.05; '
        'Diāna Bar 13:00–22:00 on Sat 02.05.</li>'
    )
    parts.append(
        '<li><strong>Dana (probation):</strong> cannot open/close → never the lone first-in / last-out. '
        'No explicit "pair with senior" constraint in this run.</li>'
    )
    parts.append(
        f'<li><strong>Shift bounds:</strong> {SETTINGS["min_shift_minutes"]//60}h–'
        f'{SETTINGS["max_shift_minutes"]//60}h hard, '
        f'preferred {SETTINGS["soft_min_shift_minutes"]//60}h–'
        f'{SETTINGS["soft_max_shift_minutes"]//60}h. '
        f'{SETTINGS["min_rest_between_shifts"]}h rest between shifts.</li>'
    )
    parts.append('</ul></div></div>')

    # ── Case Summary ──────────────────────────────────────────────────────────
    parts.append('<div class="section"><h2>Case Summary</h2>')
    parts.append('<div class="case-grid">')

    # Opening hours card
    parts.append('<div class="req-card"><h4>Opening Hours</h4>')
    parts.append('<table class="data-table compact">')
    parts.append('<tr><td>Monday</td><td class="center"><strong>Closed</strong></td></tr>')
    parts.append('<tr><td>Tuesday – Thursday</td><td class="center"><strong>15:00 – 22:00</strong></td></tr>')
    parts.append('<tr><td>Friday</td><td class="center"><strong>15:00 – 23:00</strong></td></tr>')
    parts.append('<tr><td>Saturday</td><td class="center"><strong>13:00 – 22:00</strong></td></tr>')
    parts.append('<tr><td>Sunday</td><td class="center"><strong>13:00 – 22:00</strong></td></tr>')
    parts.append('<tr><td>Head bartender pre-open</td><td class="center"><strong>14:30 (weekdays)</strong></td></tr>')
    parts.append('</table></div>')

    # Settings card
    parts.append('<div class="req-card"><h4>Schedule Settings</h4>')
    parts.append('<table class="data-table compact">')
    parts.append(f'<tr><td>Shift length (hard)</td><td class="center"><strong>'
                 f'{SETTINGS["min_shift_minutes"]//60}h – {SETTINGS["max_shift_minutes"]//60}h</strong></td></tr>')
    parts.append(f'<tr><td>Shift length (preferred)</td><td class="center"><strong>'
                 f'{SETTINGS["soft_min_shift_minutes"]//60}h – {SETTINGS["soft_max_shift_minutes"]//60}h</strong></td></tr>')
    parts.append(f'<tr><td>Max hours/day</td><td class="center"><strong>{SETTINGS["max_hours_per_day"]}h</strong></td></tr>')
    parts.append(f'<tr><td>Min rest between shifts</td><td class="center"><strong>{SETTINGS["min_rest_between_shifts"]}h</strong></td></tr>')
    parts.append(f'<tr><td>Granularity</td><td class="center"><strong>{SETTINGS["granularity_minutes"]} min</strong></td></tr>')
    parts.append(f'<tr><td>Staff during quiet / peak</td><td class="center"><strong>2 / 3</strong></td></tr>')
    parts.append('</table></div>')
    parts.append('</div>')  # case-grid

    # Workers table
    parts.append('<h3 style="margin-top:24px">Workers</h3>')
    parts.append('<table class="data-table"><thead><tr>'
                 '<th>Worker</th><th>Role</th><th>Skill</th><th>Rating</th><th>Contract</th>'
                 '<th>Min (2w)</th><th>Optimal (2w)</th>'
                 '<th>Can Open</th><th>Can Close</th><th>Constraints</th>'
                 '</tr></thead><tbody>')
    for wk in workers:
        wid = wk["id"]
        color = WORKER_COLORS[wid]
        skill = wk["skill_ids"][0]
        rating = wk["skill_ratings"].get(skill, "–")
        contract_label = CONTRACTS[wid][0]
        period_min = wk.get("monthly_min_hours", "–")
        period_opt = wk.get("monthly_optimal_hours", "–")
        can_open = "✓" if wk.get("can_open") else "✗"
        can_close = "✓" if wk.get("can_close") else "✗"

        constraints = []
        vacation_days = []
        recurring = []
        for d in range(NUM_DAYS):
            uas = ua_by_worker_day.get((wid, d), [])
            for ua in uas:
                if ua.get("is_full_day"):
                    vacation_days.append(d)
                else:
                    s = mins_to_time(ua.get("start_minutes", 0))
                    e = mins_to_time(ua.get("end_minutes", 0))
                    recurring.append(f"{fmt_date(d)} off {s}–{e}")
        if vacation_days:
            constraints.extend(_group_day_ranges(vacation_days))
        if recurring:
            if len(recurring) <= 3:
                constraints.extend(recurring)
            else:
                constraints.append(f"{recurring[0]}, +{len(recurring)-1} more partial")
        constraint_str = "; ".join(constraints) if constraints else '<span class="avail-ok">Fully available</span>'

        parts.append(
            f'<tr><td><span class="dot" style="background:{color}"></span>'
            f'<strong>{WORKER_NAMES[wid]}</strong></td>'
            f'<td>{WORKER_ROLE_LABEL[wid]}</td>'
            f'<td>{skill}</td><td class="center">{rating}</td><td>{contract_label}</td>'
            f'<td class="center">{period_min}h</td><td class="center">{period_opt}h</td>'
            f'<td class="center">{can_open}</td><td class="center">{can_close}</td>'
            f'<td class="constraint-cell">{constraint_str}</td></tr>'
        )
    parts.append('</tbody></table>')
    parts.append('</div>')  # section

    # ── 2-Week Calendar Overview ──────────────────────────────────────────────
    parts.append('<div class="section"><h2>2-Week Overview</h2>')
    parts.append('<div class="month-grid">')
    parts.append('<div class="month-header">')
    for dn in DAY_SHORT:
        parts.append(f'<span>{dn}</span>')
    parts.append('</div>')

    first_wd = START.weekday()
    cell_idx = 0
    parts.append('<div class="month-row">')
    for _ in range(first_wd):
        parts.append('<div class="day-cell empty"></div>')
        cell_idx += 1
    for d in range(NUM_DAYS):
        if cell_idx > 0 and cell_idx % 7 == 0:
            parts.append('</div><div class="month-row">')
        info = day_info[d]
        dt = day_date(d)
        if info["closed"]:
            cls = "day-cell closed"
            extra = '<span class="closed-badge">Closed</span>'
        elif info["ok"]:
            cls = "day-cell ok"
            extra = ""
        else:
            cls = "day-cell gap"
            gh = info["gap_mins"] / 60
            extra = f'<span class="gap-badge">{gh:.1f}h gap</span>'
        parts.append(
            f'<a href="#day-{d}" class="{cls}">'
            f'<span class="day-num">{dt.day}</span>'
            f'<span class="day-wd">{DAY_SHORT[dt.weekday()]}</span>'
            f'{extra}</a>'
        )
        cell_idx += 1
    while cell_idx % 7 != 0:
        parts.append('<div class="day-cell empty"></div>')
        cell_idx += 1
    parts.append('</div></div></div>')

    # ── Weekly Schedule Grid (workers × days) ─────────────────────────────────
    parts.append('<div class="section"><h2>Weekly Schedule Grid</h2>')
    parts.append('<p class="sub" style="margin-bottom:12px">'
                 'Each row is a worker; each column is a day. Cells show the shift time. '
                 '🔒 = pinned / pre-committed.  Pink = unavailable full day.  Grey = closed.</p>')

    grid = build_weekly_grid(scenario, assignments)

    parts.append('<div class="weekgrid-wrap"><table class="weekgrid"><thead>')
    parts.append('<tr><th class="worker-col">Worker</th>')
    for d in range(NUM_DAYS):
        wd = weekday(d)
        dt = day_date(d)
        cls = ""
        if wd in CLOSED_WEEKDAYS:
            cls = "closed-col"
        elif wd in (5, 6):
            cls = "weekend-col"
        sep = " week-sep" if d == 7 else ""
        parts.append(
            f'<th class="{cls}{sep}">{DAY_SHORT[wd]}<br>{fmt_date(d)}</th>'
        )
    parts.append('<th class="col-hours">Total</th></tr></thead><tbody>')

    # Worker-hour totals (recompute from assignments for accuracy)
    a_hours = defaultdict(float)
    for a in assignments:
        a_hours[a["worker_id"]] += (a["end_minutes"] - a["start_minutes"]) / 60

    for wid in WORKER_ORDER:
        color = WORKER_COLORS[wid]
        parts.append('<tr>')
        parts.append(
            f'<td class="worker-col">'
            f'<span class="dot" style="background:{color}"></span>'
            f'<span class="w-name">{WORKER_NAMES[wid]}</span>'
            f'<div class="w-role">{WORKER_ROLE_LABEL[wid]}</div></td>'
        )
        for d in range(NUM_DAYS):
            cell = grid[wid][d]
            sep = " week-sep" if d == 7 else ""
            kind = cell["kind"]
            if kind == "closed":
                parts.append(f'<td class="cell-closed{sep}">—</td>')
            elif kind == "shift":
                lock = '<span class="lock">🔒 </span>' if cell.get("locked") else ""
                pinned_cls = " pinned" if cell.get("locked") else ""
                parts.append(
                    f'<td class="cell-shift{pinned_cls}{sep}">{lock}{cell["text"]}'
                    f'<span class="skill-label">{cell.get("skill","")}</span></td>'
                )
            elif kind == "off":
                parts.append(f'<td class="cell-off{sep}">Off</td>')
            elif kind == "partial-off":
                parts.append(f'<td class="cell-partial{sep}">—</td>')
            else:
                parts.append(f'<td class="cell-free{sep}">—</td>')
        parts.append(
            f'<td class="col-hours">{a_hours[wid]:.1f}h</td></tr>'
        )
    parts.append('</tbody></table></div>')

    parts.append('<div class="legend">')
    parts.append('<span><span class="swatch" style="background:#ecfdf5;border:1px solid #a7f3d0"></span>Scheduled shift</span>')
    parts.append('<span><span class="swatch" style="background:#fef3c7;border:2px solid #f59e0b"></span>Pinned (locked)</span>')
    parts.append('<span><span class="swatch" style="background:#fef2f2;border:1px solid #fecaca"></span>Unavailable full day</span>')
    parts.append('<span><span class="swatch" style="background:#f8fafc;border:1px solid #e2e8f0"></span>Café closed</span>')
    parts.append('</div></div>')

    # ── Hour Targets Analysis ─────────────────────────────────────────────────
    parts.append('<div class="section"><h2>Hour Targets — Min / Optimal vs Actual</h2>')
    parts.append('<p class="sub" style="margin-bottom:16px">'
                 '2-week prorated targets. Week 1 = 27.04–03.05 (d0–d6). Week 2 = 04.05–10.05 (d7–d13). '
                 'Actuals are computed from solver-assigned shifts.</p>')

    # Week split
    wk_hours = defaultdict(lambda: {"w1": 0.0, "w2": 0.0})
    for a in assignments:
        hrs = (a["end_minutes"] - a["start_minutes"]) / 60
        key = "w1" if a["day"] < 7 else "w2"
        wk_hours[a["worker_id"]][key] += hrs

    parts.append('<table class="data-table"><thead><tr>'
                 '<th>Worker</th><th>Skill</th><th>Contract</th>'
                 '<th>Min (2w)</th><th>Optimal (2w)</th>'
                 '<th>Week 1</th><th>Week 2</th><th>Total</th>'
                 '<th>vs Min</th><th>vs Optimal</th><th>Bar</th>'
                 '</tr></thead><tbody>')

    max_h = max([a_hours[w] for w in WORKER_ORDER] + [1])
    total_target_min = 0
    total_target_opt = 0
    total_actual = 0
    for wid in WORKER_ORDER:
        contract_label, period_min, period_opt = CONTRACTS[wid]
        actual = a_hours[wid]
        skill = list(SKILL_RATINGS[wid].keys())[0]
        color = WORKER_COLORS[wid]
        pct = (actual / max_h) * 100 if max_h > 0 else 0

        total_target_min += period_min
        total_target_opt += period_opt
        total_actual += actual

        delta_min = actual - period_min
        min_cls = "delta-ok" if delta_min >= 0 else "delta-bad"
        min_str = f"{delta_min:+.1f}h"

        delta_opt = actual - period_opt
        if abs(delta_opt) <= 5:
            opt_cls = "delta-ok"
        elif delta_opt > 0:
            opt_cls = "delta-warn"
        else:
            opt_cls = "delta-bad"
        opt_str = f"{delta_opt:+.1f}h"

        w1 = wk_hours[wid]["w1"]
        w2 = wk_hours[wid]["w2"]
        parts.append(
            f'<tr><td><span class="dot" style="background:{color}"></span>'
            f'<strong>{WORKER_NAMES[wid]}</strong></td>'
            f'<td>{skill}</td><td>{contract_label}</td>'
            f'<td class="center">{period_min}h</td>'
            f'<td class="center">{period_opt}h</td>'
            f'<td class="center">{w1:.1f}h</td>'
            f'<td class="center">{w2:.1f}h</td>'
            f'<td class="center"><strong>{actual:.1f}h</strong></td>'
            f'<td class="center {min_cls}">{min_str}</td>'
            f'<td class="center {opt_cls}">{opt_str}</td>'
            f'<td class="bar-cell"><div class="bar" style="width:{max(pct,2):.1f}%;background:{color}"></div></td>'
            f'</tr>'
        )

    delta_total_min = total_actual - total_target_min
    delta_total_opt = total_actual - total_target_opt
    parts.append(
        f'<tr class="total-row"><td colspan="3">TOTALS</td>'
        f'<td class="center">{total_target_min}h</td>'
        f'<td class="center">{total_target_opt}h</td>'
        f'<td></td><td></td>'
        f'<td class="center">{total_actual:.1f}h</td>'
        f'<td class="center">{delta_total_min:+.1f}h</td>'
        f'<td class="center">{delta_total_opt:+.1f}h</td>'
        f'<td></td></tr>'
    )
    parts.append('</tbody></table>')
    parts.append('</div>')

    # ── Per-Day Detail ────────────────────────────────────────────────────────
    parts.append('<div class="section"><h2>Daily Schedule Details</h2></div>')

    # Build pin lookup for locked markers in Gantt
    pin_keys = set()
    for p in pins:
        if p.get("is_locked"):
            pin_keys.add((p["worker_id"], p["day"], p["skill_id"],
                          p["start_minutes"], p["end_minutes"]))

    for d in range(NUM_DAYS):
        info = day_info[d]
        dt = day_date(d)
        if info["closed"]:
            status_cls = "day-closed"
        elif info["ok"]:
            status_cls = "day-ok"
        else:
            status_cls = "day-gap"

        parts.append(f'<div class="day-detail {status_cls}" id="day-{d}">')
        parts.append('<div class="day-header">')
        parts.append(f'<h3>{DAY_NAMES[dt.weekday()]} {fmt_date(d)}</h3>')
        if info["closed"]:
            parts.append('<span class="day-closed-badge">Closed — cafe not operating</span>')
        elif not info["ok"]:
            gh = info["gap_mins"] / 60
            n_short = len(info["shortages"])
            parts.append(
                f'<span class="day-gap-badge">'
                f'{n_short} gap{"s" if n_short != 1 else ""} ({gh:.1f} worker-hours short)</span>'
            )
        else:
            parts.append('<span class="day-ok-badge">✓ Fully covered</span>')
        parts.append('</div>')

        if info["closed"]:
            parts.append('</div>')
            continue

        # Availability chips
        parts.append('<div class="avail-row">')
        for wid in WORKER_ORDER:
            uas = ua_by_worker_day.get((wid, d), [])
            color = WORKER_COLORS[wid]
            name = WORKER_NAMES[wid]
            if any(ua.get("is_full_day") for ua in uas):
                parts.append(f'<span class="avail-chip off">'
                             f'<span class="dot" style="background:{color}"></span>{name}: Off</span>')
            elif uas:
                c = []
                for ua in uas:
                    if not ua.get("is_full_day") and ua.get("start_minutes") is not None:
                        c.append(
                            f'{mins_to_time(ua["start_minutes"])}–{mins_to_time(ua["end_minutes"])}'
                        )
                parts.append(f'<span class="avail-chip partial">'
                             f'<span class="dot" style="background:{color}"></span>{name}: off {", ".join(c)}</span>')
            else:
                parts.append(f'<span class="avail-chip on">'
                             f'<span class="dot" style="background:{color}"></span>{name}</span>')
        parts.append('</div>')

        all_starts = [c["start_minutes"] for c in info["covs"]] + [a["start_minutes"] for a in info["assigns"]]
        all_ends = [c["end_minutes"] for c in info["covs"]] + [a["end_minutes"] for a in info["assigns"]]
        if not all_starts:
            parts.append('</div>')
            continue
        chart_start = min(all_starts)
        chart_end = max(all_ends)
        total_mins = chart_end - chart_start
        if total_mins <= 0:
            parts.append('</div>')
            continue

        parts.append('<div class="gantt-wrap">')

        skills_in_day = sorted(set(
            [c["skill_id"] for c in info["covs"]] + [a["skill_id"] for a in info["assigns"]]
        ))
        for skill in skills_in_day:
            skill_assigns = sorted(
                [a for a in info["assigns"] if a["skill_id"] == skill],
                key=lambda a: (a["start_minutes"], WORKER_ORDER.index(a["worker_id"])
                               if a["worker_id"] in WORKER_ORDER else 99)
            )
            skill_gaps = [s for s in info["shortages"] if s["skill"] == skill]
            skill_covs = [c for c in info["covs"] if c["skill_id"] == skill]

            num_lanes = max(len(skill_assigns) + len(skill_gaps), 1)
            lane_h = 36
            group_h = num_lanes * lane_h + 4

            parts.append('<div class="gantt-role-group">')
            parts.append(
                f'<div class="gantt-role-label" style="height:{group_h}px"><span>{skill}</span></div>'
            )
            parts.append('<div class="gantt-lanes">')

            for c in skill_covs:
                lp = ((c["start_minutes"] - chart_start) / total_mins) * 100
                wp = ((c["end_minutes"] - c["start_minutes"]) / total_mins) * 100
                mw = c["min_workers"]
                parts.append(
                    f'<div class="gantt-demand" style="left:{lp:.2f}%;width:{wp:.2f}%;'
                    f'height:{group_h - 4}px" title="Need {mw} worker(s) '
                    f'{mins_to_time(c["start_minutes"])}–{mins_to_time(c["end_minutes"])}">'
                    f'<span class="demand-label">need {mw}</span></div>'
                )

            for lane, a in enumerate(skill_assigns):
                lp = ((a["start_minutes"] - chart_start) / total_mins) * 100
                wp = ((a["end_minutes"] - a["start_minutes"]) / total_mins) * 100
                color = WORKER_COLORS.get(a["worker_id"], "#888")
                dur = (a["end_minutes"] - a["start_minutes"]) / 60
                key = (a["worker_id"], a["day"], a["skill_id"], a["start_minutes"], a["end_minutes"])
                is_pinned = a.get("is_locked") or key in pin_keys
                pinned_cls = " pinned" if is_pinned else ""
                lock_icon = '<span class="bar-lock">🔒</span>' if is_pinned else ""
                parts.append(
                    f'<div class="gantt-bar{pinned_cls}" style="left:{lp:.2f}%;width:{wp:.2f}%;'
                    f'background:{color}18;border-left:3px solid {color};top:{lane * lane_h + 2}px">'
                    f'{lock_icon}<span class="bar-name" style="color:{color}">{a["worker_name"]}</span>'
                    f'<span class="bar-time">{mins_to_time(a["start_minutes"])}–'
                    f'{mins_to_time(a["end_minutes"])}</span>'
                    f'<span class="bar-dur">{dur:.1f}h</span></div>'
                )

            for gi, s in enumerate(skill_gaps):
                # Reparse HH:MM–HH:MM window string back into minutes
                start_str, end_str = s["window"].split("–")
                g_start = int(start_str[:2]) * 60 + int(start_str[3:5])
                g_end = int(end_str[:2]) * 60 + int(end_str[3:5])
                lp = ((g_start - chart_start) / total_mins) * 100
                wp = ((g_end - g_start) / total_mins) * 100
                top = (len(skill_assigns) + gi) * lane_h + 2
                parts.append(
                    f'<div class="gantt-gap" style="left:{lp:.2f}%;width:{wp:.2f}%;top:{top}px">'
                    f'GAP {s["window"]}: short by {s["short_by"]} worker</div>'
                )

            parts.append(f'<div style="height:{group_h}px"></div>')
            parts.append('</div></div>')

        parts.append('<div class="gantt-axis">')
        parts.append('<div class="gantt-role-label-spacer"></div><div class="gantt-time-labels">')
        for hour in range(chart_start // 60, chart_end // 60 + 1):
            m = hour * 60
            if m < chart_start or m > chart_end:
                continue
            lp = ((m - chart_start) / total_mins) * 100
            parts.append(f'<span class="tick" style="left:{lp:.2f}%">{hour:02d}:00</span>')
        parts.append('</div></div>')

        parts.append('</div></div>')  # gantt-wrap + day-detail

    # ── Solver Diagnostics ────────────────────────────────────────────────────
    parts.append('<div class="section"><h2>Solver Diagnostics</h2>')
    parts.append('<ul class="diag-list">')
    for dg in response.get("diagnostics", []):
        parts.append(f'<li>{dg}</li>')
    parts.append('</ul>')

    if violations:
        parts.append(f'<h3 style="margin-top:16px;color:#dc2626">'
                     f'Constraint Violations ({len(violations)})</h3>')
        parts.append('<table class="data-table compact"><thead><tr>'
                     '<th>Code</th><th>Message</th><th>Worker</th><th>Day</th><th>Time</th>'
                     '</tr></thead><tbody>')
        for v in violations[:50]:
            t_str = ""
            if v.get("start_minutes") is not None and v.get("end_minutes") is not None:
                t_str = f'{mins_to_time(v["start_minutes"])}–{mins_to_time(v["end_minutes"])}'
            parts.append(
                f'<tr class="gap-row"><td>{v.get("code", "")}</td>'
                f'<td>{v.get("message", "")}</td>'
                f'<td>{WORKER_NAMES.get(v.get("worker_id", ""), v.get("worker_id", "–"))}</td>'
                f'<td>{v.get("day", "–")}</td><td>{t_str}</td></tr>'
            )
        if len(violations) > 50:
            parts.append(f'<tr><td colspan="5">... and {len(violations)-50} more</td></tr>')
        parts.append('</tbody></table>')

    if gaps:
        parts.append(f'<h3 style="margin-top:16px;color:#dc2626">Coverage Gaps (raw — {len(gaps)})</h3>')
        parts.append('<table class="data-table compact"><thead><tr>'
                     '<th>Day</th><th>Time</th><th>Skill</th><th>Need</th><th>Have</th>'
                     '</tr></thead><tbody>')
        for g in gaps:
            dt = day_date(g["day"])
            parts.append(
                f'<tr class="gap-row"><td>{DAY_SHORT[dt.weekday()]} {fmt_date(g["day"])}</td>'
                f'<td>{mins_to_time(g["start_minutes"])}–{mins_to_time(g["end_minutes"])}</td>'
                f'<td>{g["skill_id"]}</td><td class="center">{g["required"]}</td>'
                f'<td class="center">{g["assigned"]}</td></tr>'
            )
        parts.append('</tbody></table>')

    parts.append('</div>')
    parts.append('</body></html>')
    return '\n'.join(parts)


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    try:
        resp = requests.get(f"{SOLVER_URL}/health", timeout=5)
        print(f"Solver: {resp.json()}")
    except requests.ConnectionError:
        print(f"Solver not running at {SOLVER_URL}")
        print("  Start it:  cd solver && python main.py")
        return

    scenario = build_scenario()
    print(f"Scenario: {NUM_DAYS} days, {len(scenario['workers'])} workers, "
          f"{len(scenario['coverage_windows'])} coverage windows, "
          f"{len(scenario['unavailability'])} unavailability entries, "
          f"{len(scenario['existing_assignments'])} pinned shifts")

    print("\nWorker contracts:")
    for wid in WORKER_ORDER:
        label, mn, opt = CONTRACTS[wid]
        skill = list(SKILL_RATINGS[wid].keys())[0]
        print(f"  {WORKER_NAMES[wid]:8s}  {skill:6s}  {label:10s}  min={mn}h  optimal={opt}h")

    print(f"\nSolving (timeout {scenario['solver_timeout_seconds']}s) ...", flush=True)
    resp = requests.post(f"{SOLVER_URL}/solve", json=scenario, timeout=180)
    if resp.status_code != 200:
        print(f"Solver error {resp.status_code}: {resp.text[:300]}")
        return

    result = resp.json()
    hours = result.get("total_hours_by_worker", {})
    print(f"\n  status={result['status']}  shifts={len(result['assignments'])}  "
          f"gaps={len(result['coverage_gaps'])}  solve_time={result['solve_time_ms']}ms")

    print("\n2-week hours — target vs actual:")
    print(f"  {'Worker':8s}  {'Skill':6s}  {'Min':>5s}  {'Opt':>5s}  {'Actual':>7s}  {'Δ Min':>7s}  {'Δ Opt':>7s}")
    print(f"  {'─'*8}  {'─'*6}  {'─'*5}  {'─'*5}  {'─'*7}  {'─'*7}  {'─'*7}")
    for wid in WORKER_ORDER:
        label, mn, opt = CONTRACTS[wid]
        actual = hours.get(wid, 0)
        skill = list(SKILL_RATINGS[wid].keys())[0]
        d_min = actual - mn
        d_opt = actual - opt
        flag_min = "✓" if d_min >= 0 else "✗"
        flag_opt = "✓" if abs(d_opt) <= 10 else ("~" if abs(d_opt) <= 20 else "✗")
        print(f"  {WORKER_NAMES[wid]:8s}  {skill:6s}  {mn:5d}  {opt:5d}  {actual:7.1f}  "
              f"{d_min:+6.1f}{flag_min}  {d_opt:+6.1f}{flag_opt}")

    if result.get("coverage_gaps"):
        print(f"\nCoverage gaps ({len(result['coverage_gaps'])}):")
        for g in result["coverage_gaps"]:
            dt = day_date(g["day"])
            print(f"  {DAY_SHORT[dt.weekday()]} {fmt_date(g['day'])} "
                  f"{mins_to_time(g['start_minutes'])}-{mins_to_time(g['end_minutes'])}  "
                  f"{g['skill_id']}: need {g['required']}, have {g['assigned']}")

    html = build_html(scenario, result)
    out = Path(__file__).parent / "ziedonis_report.html"
    out.write_text(html, encoding="utf-8")
    print(f"\nReport → {out}")
    webbrowser.open(f"file://{out.resolve()}")


if __name__ == "__main__":
    main()
