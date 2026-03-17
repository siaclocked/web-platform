"""
Clocked Cafe — May 2026 Monthly Schedule Test

Generates a 31-day scenario for the Clocked Cafe with 12 workers
(Floor + Bar), calls the solver, and produces may_cafe_report.html with:
  1. Case summary (workers, contracts, constraints)
  2. Month-overview calendar (green/red per day)
  3. Monthly hour targets analysis (min/optimal vs actual)
  4. Per-day Gantt charts with worker bars and gap indicators
  5. Solver diagnostics

Run:   python run_test.py
Open:  solver/tests/may_cafe/may_cafe_report.html

Requires the solver running at http://localhost:8000
"""

import requests
import webbrowser
from datetime import timedelta
from pathlib import Path

from scenario import (
    START, NUM_DAYS, PLACE_ID, PUBLIC_HOLIDAYS,
    DAY_NAMES, DAY_SHORT,
    WORKER_ORDER, WORKER_NAMES, WORKER_COLORS, CONTRACTS,
    SKILL_RATINGS, WORKER_FLAGS,
    SETTINGS,
    weekday, day_date, build_scenario,
)

SOLVER_URL = "http://localhost:8000"


def mins_to_time(m):
    return f"{int(m) // 60:02d}:{int(m) % 60:02d}"


# ── HTML report ──────────────────────────────────────────────────────────────

def build_html(scenario, response):
    assignments = response.get("assignments", [])
    gaps = response.get("coverage_gaps", [])
    hours = response.get("total_hours_by_worker", {})
    covs = scenario["coverage_windows"]
    unavails = scenario["unavailability"]
    workers = scenario["workers"]
    violations = response.get("constraint_violations", [])

    # Per-day stats
    day_info = {}
    for d in range(NUM_DAYS):
        d_assigns = [a for a in assignments if a["day"] == d]
        d_gaps = [g for g in gaps if g["day"] == d]
        d_covs = [c for c in covs if c["day"] == d]
        gap_mins = sum(g["end_minutes"] - g["start_minutes"] for g in d_gaps)
        day_info[d] = {
            "assigns": d_assigns, "gaps": d_gaps, "covs": d_covs,
            "gap_mins": gap_mins, "ok": len(d_gaps) == 0,
        }

    # Per-worker unavailability lookup
    ua_by_worker_day = {}
    for ua in unavails:
        ua_by_worker_day.setdefault((ua["worker_id"], ua["day"]), []).append(ua)

    parts = [HTML_HEAD]

    # ── Header ────────────────────────────────────────────────────────────────
    parts.append('<div class="report-header">')
    parts.append('<h1>Clocked Cafe — May 2026 Monthly Schedule</h1>')
    parts.append(f'<p class="sub">Test focus: <strong>Monthly min/max hour targets</strong> '
                 f'&nbsp;·&nbsp; {response["status"]} · {len(assignments)} shifts · '
                 f'{len(gaps)} gaps · {response["solve_time_ms"]}ms</p>')
    parts.append('<p class="sub">12 workers · 2 skills (Floor, Bar) · '
                 f'{len(covs)} coverage windows · 31 days</p>')
    parts.append('</div>')

    # ── Case Summary ──────────────────────────────────────────────────────────
    parts.append('<div class="section"><h2>Case Summary</h2>')
    parts.append('<div class="case-grid">')

    # Opening hours card
    parts.append('<div class="req-card"><h4>Opening Hours</h4>')
    parts.append('<table class="data-table compact">')
    parts.append('<tr><td>Mon–Thu</td><td class="center"><strong>08:00–20:00</strong></td></tr>')
    parts.append('<tr><td>Friday</td><td class="center"><strong>08:00–22:00</strong></td></tr>')
    parts.append('<tr><td>Saturday</td><td class="center"><strong>09:00–22:00</strong></td></tr>')
    parts.append('<tr><td>Sunday</td><td class="center"><strong>09:00–18:00</strong></td></tr>')
    parts.append('<tr><td>Public Holiday (May 4)</td><td class="center"><strong>Sunday hours</strong></td></tr>')
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
    parts.append('</table></div>')
    parts.append('</div>')  # case-grid

    # Workers table
    parts.append('<h3 style="margin-top:24px">Workers</h3>')
    parts.append('<table class="data-table"><thead><tr>'
                 '<th>Worker</th><th>Skill</th><th>Level</th><th>Contract</th>'
                 '<th>Monthly Min</th><th>Monthly Optimal</th>'
                 '<th>Can Open</th><th>Can Close</th><th>Constraints</th>'
                 '</tr></thead><tbody>')
    for wk in workers:
        wid = wk["id"]
        color = WORKER_COLORS[wid]
        skills = wk["skill_ids"]
        skill = skills[0]
        rating = wk["skill_ratings"].get(skill, "–")
        level = "Senior" if rating >= 8 else ("Mid" if rating >= 6 else "Junior")
        contract_label = CONTRACTS[wid][0]
        monthly_min = wk.get("monthly_min_hours", "–")
        monthly_opt = wk.get("monthly_optimal_hours", "–")
        can_open = "✓" if wk.get("can_open") else "✗"
        can_close = "✓" if wk.get("can_close") else "✗"

        # Summarise constraints
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
                    recurring.append(f"Day {d} off {s}–{e}")

        if vacation_days:
            # Group into ranges
            ranges = _group_day_ranges(vacation_days)
            constraints.extend(ranges)
        if recurring:
            # Show first few
            if len(recurring) <= 3:
                constraints.extend(recurring)
            else:
                constraints.append(f"{len(recurring)} partial-day restrictions")

        constraint_str = "; ".join(constraints) if constraints else '<span class="avail-ok">Full availability</span>'

        parts.append(
            f'<tr><td><span class="dot" style="background:{color}"></span>'
            f'<strong>{WORKER_NAMES[wid]}</strong></td>'
            f'<td>{skill}</td><td>{level}</td><td>{contract_label}</td>'
            f'<td class="center">{monthly_min}h</td><td class="center">{monthly_opt}h</td>'
            f'<td class="center">{can_open}</td><td class="center">{can_close}</td>'
            f'<td class="constraint-cell">{constraint_str}</td></tr>'
        )
    parts.append('</tbody></table>')
    parts.append('</div>')  # section

    # ── Month Overview Calendar ───────────────────────────────────────────────
    parts.append('<div class="section month-section"><h2>Month Overview</h2>')
    parts.append('<div class="month-grid">')
    parts.append('<div class="month-header">')
    for dn in DAY_SHORT:
        parts.append(f'<span>{dn}</span>')
    parts.append('</div>')

    first_wd = START.weekday()  # 4 = Friday
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
        cls = "day-cell ok" if info["ok"] else "day-cell gap"
        extra = ""
        if d in PUBLIC_HOLIDAYS:
            extra = '<span class="holiday-badge">Holiday</span>'
        gap_label = ""
        if not info["ok"]:
            gh = info["gap_mins"] / 60
            gap_label = f'<span class="gap-badge">{gh:.1f}h gap</span>'
        parts.append(
            f'<a href="#day-{d}" class="{cls}">'
            f'<span class="day-num">{dt.day}</span>'
            f'<span class="day-wd">{DAY_SHORT[dt.weekday()]}</span>'
            f'{extra}{gap_label}</a>'
        )
        cell_idx += 1

    while cell_idx % 7 != 0:
        parts.append('<div class="day-cell empty"></div>')
        cell_idx += 1
    parts.append('</div></div></div>')

    # ── Monthly Hour Targets Analysis ─────────────────────────────────────────
    parts.append('<div class="section"><h2>Monthly Hour Targets — Min / Optimal vs Actual</h2>')
    parts.append('<p class="sub" style="margin-bottom:16px">'
                 'This is the primary metric for this test. The solver should schedule each worker '
                 'close to their <strong>optimal</strong> target and never significantly below '
                 'their <strong>minimum</strong> target.</p>')

    parts.append('<table class="data-table"><thead><tr>'
                 '<th>Worker</th><th>Skill</th><th>Contract</th>'
                 '<th>Min Target</th><th>Optimal Target</th><th>Actual Hours</th>'
                 '<th>vs Min</th><th>vs Optimal</th><th>Bar</th>'
                 '</tr></thead><tbody>')

    max_h = max(hours.values()) if hours and max(hours.values()) > 0 else 1
    total_target_min = 0
    total_target_opt = 0
    total_actual = 0
    floor_total = 0
    bar_total = 0

    for wid in WORKER_ORDER:
        contract_label, monthly_min, monthly_opt = CONTRACTS[wid]
        actual = hours.get(wid, 0)
        skill = list(SKILL_RATINGS[wid].keys())[0]
        color = WORKER_COLORS[wid]
        pct = (actual / max_h) * 100 if max_h > 0 else 0

        total_target_min += monthly_min
        total_target_opt += monthly_opt
        total_actual += actual
        if skill == "Floor":
            floor_total += actual
        else:
            bar_total += actual

        # Delta vs min
        delta_min = actual - monthly_min
        if delta_min >= 0:
            min_cls = "delta-ok"
            min_str = f"+{delta_min:.1f}h"
        else:
            min_cls = "delta-bad"
            min_str = f"{delta_min:.1f}h"

        # Delta vs optimal
        delta_opt = actual - monthly_opt
        if abs(delta_opt) <= 5:
            opt_cls = "delta-ok"
        elif delta_opt > 0:
            opt_cls = "delta-warn"
        else:
            opt_cls = "delta-bad"
        opt_str = f"{delta_opt:+.1f}h"

        parts.append(
            f'<tr><td><span class="dot" style="background:{color}"></span>'
            f'<strong>{WORKER_NAMES[wid]}</strong></td>'
            f'<td>{skill}</td><td>{contract_label}</td>'
            f'<td class="center">{monthly_min}h</td>'
            f'<td class="center">{monthly_opt}h</td>'
            f'<td class="center"><strong>{actual:.1f}h</strong></td>'
            f'<td class="center {min_cls}">{min_str}</td>'
            f'<td class="center {opt_cls}">{opt_str}</td>'
            f'<td class="bar-cell"><div class="bar" style="width:{max(pct,2):.1f}%;background:{color}"></div></td>'
            f'</tr>'
        )

    # Totals row
    delta_total_min = total_actual - total_target_min
    delta_total_opt = total_actual - total_target_opt
    parts.append(
        f'<tr class="total-row"><td colspan="3"><strong>TOTALS</strong></td>'
        f'<td class="center"><strong>{total_target_min}h</strong></td>'
        f'<td class="center"><strong>{total_target_opt}h</strong></td>'
        f'<td class="center"><strong>{total_actual:.1f}h</strong></td>'
        f'<td class="center"><strong>{delta_total_min:+.1f}h</strong></td>'
        f'<td class="center"><strong>{delta_total_opt:+.1f}h</strong></td>'
        f'<td></td></tr>'
    )
    parts.append('</tbody></table>')

    # Skill totals
    parts.append(f'<p class="sub" style="margin-top:12px">'
                 f'Floor total: <strong>{floor_total:.1f}h</strong> · '
                 f'Bar total: <strong>{bar_total:.1f}h</strong></p>')
    parts.append('</div>')

    # ── Per-Day Detail ────────────────────────────────────────────────────────
    parts.append('<div class="section"><h2>Daily Schedule Details</h2></div>')

    for d in range(NUM_DAYS):
        info = day_info[d]
        dt = day_date(d)
        status_cls = "day-ok" if info["ok"] else "day-gap"
        holiday_tag = ' <span class="holiday-inline">Public Holiday</span>' if d in PUBLIC_HOLIDAYS else ""

        parts.append(f'<div class="day-detail {status_cls}" id="day-{d}">')
        parts.append(f'<div class="day-header">')
        parts.append(f'<h3>May {dt.day} — {DAY_NAMES[dt.weekday()]}{holiday_tag}</h3>')
        if not info["ok"]:
            gh = info["gap_mins"] / 60
            parts.append(f'<span class="day-gap-badge">'
                         f'{len(info["gaps"])} gap{"s" if len(info["gaps"]) != 1 else ""} ({gh:.1f}h)</span>')
        else:
            parts.append('<span class="day-ok-badge">✓ Fully covered</span>')
        parts.append('</div>')

        # Availability row
        parts.append('<div class="avail-row">')
        for wid in WORKER_ORDER:
            uas = ua_by_worker_day.get((wid, d), [])
            color = WORKER_COLORS[wid]
            name = WORKER_NAMES[wid]
            if any(ua.get("is_full_day") for ua in uas):
                parts.append(f'<span class="avail-chip off">'
                             f'<span class="dot" style="background:{color}"></span>{name}: Off</span>')
            elif uas:
                constraints = []
                for ua in uas:
                    if not ua.get("is_full_day") and ua.get("start_minutes") is not None:
                        constraints.append(
                            f'{mins_to_time(ua["start_minutes"])}–{mins_to_time(ua["end_minutes"])}'
                        )
                cstr = ", ".join(constraints)
                parts.append(f'<span class="avail-chip partial">'
                             f'<span class="dot" style="background:{color}"></span>{name}: off {cstr}</span>')
            else:
                parts.append(f'<span class="avail-chip on">'
                             f'<span class="dot" style="background:{color}"></span>{name}</span>')
        parts.append('</div>')

        # Gantt chart
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

        # Group by skill
        skills_in_day = sorted(set(
            [c["skill_id"] for c in info["covs"]] + [a["skill_id"] for a in info["assigns"]]
        ))

        for skill in skills_in_day:
            skill_assigns = sorted(
                [a for a in info["assigns"] if a["skill_id"] == skill],
                key=lambda a: (a["start_minutes"], WORKER_ORDER.index(a["worker_id"])
                               if a["worker_id"] in WORKER_ORDER else 99)
            )
            skill_gaps = [g for g in info["gaps"] if g["skill_id"] == skill]
            skill_covs = [c for c in info["covs"] if c["skill_id"] == skill]

            num_lanes = max(len(skill_assigns) + len(skill_gaps), 1)
            lane_h = 36
            group_h = num_lanes * lane_h + 4

            parts.append('<div class="gantt-role-group">')
            parts.append(f'<div class="gantt-role-label" style="height:{group_h}px"><span>{skill}</span></div>')
            parts.append('<div class="gantt-lanes">')

            # Coverage demand shading
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

            # Worker bars
            for lane, a in enumerate(skill_assigns):
                lp = ((a["start_minutes"] - chart_start) / total_mins) * 100
                wp = ((a["end_minutes"] - a["start_minutes"]) / total_mins) * 100
                color = WORKER_COLORS.get(a["worker_id"], "#888")
                dur = (a["end_minutes"] - a["start_minutes"]) / 60
                parts.append(
                    f'<div class="gantt-bar" style="left:{lp:.2f}%;width:{wp:.2f}%;'
                    f'background:{color}18;border-left:3px solid {color};top:{lane * lane_h + 2}px">'
                    f'<span class="bar-name" style="color:{color}">{a["worker_name"]}</span>'
                    f'<span class="bar-time">{mins_to_time(a["start_minutes"])}–'
                    f'{mins_to_time(a["end_minutes"])}</span>'
                    f'<span class="bar-dur">{dur:.1f}h</span></div>'
                )

            # Gap bars
            for gi, g in enumerate(skill_gaps):
                lp = ((g["start_minutes"] - chart_start) / total_mins) * 100
                wp = ((g["end_minutes"] - g["start_minutes"]) / total_mins) * 100
                top = (len(skill_assigns) + gi) * lane_h + 2
                parts.append(
                    f'<div class="gantt-gap" style="left:{lp:.2f}%;width:{wp:.2f}%;top:{top}px">'
                    f'GAP {mins_to_time(g["start_minutes"])}–{mins_to_time(g["end_minutes"])}: '
                    f'need {g["required"]}, have {g["assigned"]}</div>'
                )

            parts.append(f'<div style="height:{group_h}px"></div>')
            parts.append('</div></div>')  # gantt-lanes, gantt-role-group

        # Time axis
        parts.append('<div class="gantt-axis">')
        parts.append(f'<div class="gantt-role-label-spacer"></div><div class="gantt-time-labels">')
        for hour in range(chart_start // 60, chart_end // 60 + 1):
            m = hour * 60
            if m < chart_start or m > chart_end:
                continue
            lp = ((m - chart_start) / total_mins) * 100
            parts.append(f'<span class="tick" style="left:{lp:.2f}%">{hour:02d}:00</span>')
        parts.append('</div></div>')

        parts.append('</div>')  # gantt-wrap
        parts.append('</div>')  # day-detail

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
        parts.append(f'<h3 style="margin-top:16px;color:#dc2626">Coverage Gaps ({len(gaps)})</h3>')
        parts.append('<table class="data-table compact"><thead><tr>'
                     '<th>Day</th><th>Time</th><th>Skill</th><th>Need</th><th>Have</th>'
                     '</tr></thead><tbody>')
        for g in gaps:
            dt = day_date(g["day"])
            parts.append(
                f'<tr class="gap-row"><td>May {dt.day} ({DAY_SHORT[dt.weekday()]})</td>'
                f'<td>{mins_to_time(g["start_minutes"])}–{mins_to_time(g["end_minutes"])}</td>'
                f'<td>{g["skill_id"]}</td><td class="center">{g["required"]}</td>'
                f'<td class="center">{g["assigned"]}</td></tr>'
            )
        parts.append('</tbody></table>')

    parts.append('</div>')

    parts.append('</body></html>')
    return '\n'.join(parts)


def _group_day_ranges(days):
    """Group day offsets into human-readable date ranges."""
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
            result.append(f"Off May {ds.day}")
        else:
            result.append(f"Off May {ds.day}–{de.day}")
    return result


# ── HTML styles ──────────────────────────────────────────────────────────────

HTML_HEAD = """<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Clocked Cafe — May 2026 Schedule Report</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
     background:#fff;color:#1a1a1a;line-height:1.5}
.report-header{padding:36px 48px 20px;border-bottom:1px solid #e5e5e5}
.report-header h1{font-size:26px;font-weight:700}
.sub{color:#888;font-size:13px;margin-top:4px}
.section{padding:28px 48px}
.section h2{font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#333;
  margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid #eee}
.section h3{font-size:14px;font-weight:700;color:#444;margin-bottom:10px}

/* Grid */
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
.total-row td{background:#f8f8f8;border-top:2px solid #ddd}
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

/* Month grid */
.month-grid{max-width:700px}
.month-header{display:grid;grid-template-columns:repeat(7,1fr);text-align:center;font-size:12px;
  font-weight:700;color:#888;margin-bottom:6px}
.month-row{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px}
.day-cell{border-radius:8px;padding:8px 6px;text-align:center;text-decoration:none;display:flex;
  flex-direction:column;align-items:center;min-height:64px;justify-content:center;border:1px solid #eee;
  transition:transform .1s}
.day-cell:hover{transform:scale(1.05)}
.day-cell.empty{background:#fafafa;border-color:transparent}
.day-cell.ok{background:#f0fdf4;border-color:#bbf7d0;color:#166534}
.day-cell.gap{background:#fef2f2;border-color:#fecaca;color:#991b1b}
.day-num{font-size:18px;font-weight:700;line-height:1}
.day-wd{font-size:10px;color:#999;margin-top:2px}
.gap-badge{font-size:10px;background:#fee2e2;color:#dc2626;border-radius:3px;padding:1px 5px;margin-top:3px}
.holiday-badge{font-size:9px;background:#eff6ff;color:#2563eb;border-radius:3px;padding:1px 5px;margin-top:2px}
.holiday-inline{font-size:11px;background:#eff6ff;color:#2563eb;border-radius:4px;padding:2px 8px;
  margin-left:8px;font-weight:600}

/* Day detail */
.day-detail{padding:20px 48px 28px;border-bottom:1px solid #f0f0f0}
.day-detail.day-gap{border-left:4px solid #fca5a5}
.day-detail.day-ok{border-left:4px solid #86efac}
.day-header{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.day-header h3{font-size:16px;font-weight:700;color:#111}
.day-gap-badge{font-size:12px;background:#fee2e2;color:#dc2626;border-radius:5px;padding:3px 10px;font-weight:600}
.day-ok-badge{font-size:12px;background:#dcfce7;color:#166534;border-radius:5px;padding:3px 10px;font-weight:600}

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
.gantt-role-label{width:80px;min-width:80px;display:flex;align-items:center;justify-content:center;
  font-size:12px;font-weight:700;color:#555;background:#f5f5f5;border-right:1px solid #e5e5e5;
  padding:8px 4px;text-align:center}
.gantt-role-label-spacer{width:80px;min-width:80px}
.gantt-lanes{flex:1;position:relative;min-height:40px}
.gantt-demand{position:absolute;top:0;background:#f0f9ff;border-left:2px dashed #93c5fd;
  border-right:2px dashed #93c5fd;display:flex;align-items:flex-start;justify-content:center;
  padding-top:4px;z-index:0}
.demand-label{font-size:10px;color:#60a5fa;font-weight:600}
.gantt-bar{position:absolute;height:30px;border-radius:5px;display:flex;align-items:center;
  gap:6px;padding:0 8px;font-size:12px;white-space:nowrap;overflow:hidden;z-index:1}
.bar-name{font-weight:700;font-size:12px}
.bar-time{color:#666;font-size:11px}
.bar-dur{color:#888;font-size:11px;background:#f0f0f0;padding:1px 4px;border-radius:3px}
.gantt-gap{position:absolute;height:30px;border-radius:5px;display:flex;align-items:center;
  padding:0 8px;font-size:11px;background:#fef2f2;border:1px dashed #fca5a5;color:#dc2626;
  white-space:nowrap;z-index:1}
.gantt-axis{display:flex;border-top:1px solid #e5e5e5;background:#f5f5f5}
.gantt-time-labels{flex:1;position:relative;height:24px}
.tick{position:absolute;font-size:10px;color:#aaa;transform:translateX(-50%);top:4px;font-weight:500}

/* Diagnostics */
.diag-list{list-style:none;padding:0}
.diag-list li{padding:4px 0;font-size:13px;color:#555}
.diag-list li::before{content:"→ ";color:#aaa}
.gap-row td{color:#dc2626}

@media print{.day-detail{break-inside:avoid}}
</style>
</head><body>
"""


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
          f"{len(scenario['unavailability'])} unavailability entries")

    print("\nWorker contracts:")
    for wid in WORKER_ORDER:
        label, mn, opt = CONTRACTS[wid]
        skill = list(SKILL_RATINGS[wid].keys())[0]
        print(f"  {WORKER_NAMES[wid]:8s}  {skill:5s}  {label:10s}  min={mn}h  optimal={opt}h")

    print(f"\nSolving (timeout {scenario['solver_timeout_seconds']}s) ...", flush=True)

    resp = requests.post(f"{SOLVER_URL}/solve", json=scenario, timeout=180)
    if resp.status_code != 200:
        print(f"Solver error {resp.status_code}: {resp.text[:300]}")
        return

    result = resp.json()
    hours = result.get("total_hours_by_worker", {})
    print(f"\n  {result['status']} · {len(result['assignments'])} shifts · "
          f"{len(result['coverage_gaps'])} gaps · {result['solve_time_ms']}ms")

    print("\nMonthly hours — Target vs Actual:")
    print(f"  {'Worker':8s}  {'Skill':5s}  {'Min':>5s}  {'Opt':>5s}  {'Actual':>7s}  {'Δ Min':>6s}  {'Δ Opt':>6s}")
    print(f"  {'─'*8}  {'─'*5}  {'─'*5}  {'─'*5}  {'─'*7}  {'─'*6}  {'─'*6}")
    for wid in WORKER_ORDER:
        label, mn, opt = CONTRACTS[wid]
        actual = hours.get(wid, 0)
        skill = list(SKILL_RATINGS[wid].keys())[0]
        d_min = actual - mn
        d_opt = actual - opt
        flag_min = "✓" if d_min >= 0 else "✗"
        flag_opt = "✓" if abs(d_opt) <= 10 else ("~" if abs(d_opt) <= 20 else "✗")
        print(f"  {WORKER_NAMES[wid]:8s}  {skill:5s}  {mn:5d}  {opt:5d}  {actual:7.1f}  "
              f"{d_min:+6.1f}{flag_min}  {d_opt:+6.1f}{flag_opt}")

    html = build_html(scenario, result)
    out = Path(__file__).parent / "may_cafe_report.html"
    out.write_text(html, encoding="utf-8")
    print(f"\nReport saved → {out}")
    webbrowser.open(f"file://{out.resolve()}")


if __name__ == "__main__":
    main()
