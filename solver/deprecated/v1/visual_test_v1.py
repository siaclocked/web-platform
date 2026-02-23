"""
Visual Solver Report — Gantt-chart style schedule per day.
Run:  python visual_test.py
Open: solver/schedule_report.html
"""

import requests
import webbrowser
from datetime import datetime, timedelta
from pathlib import Path
from scenarios import ALL_SCENARIOS, DAY_NAMES, next_monday

SOLVER_URL = "http://localhost:8000"

WORKER_COLORS = [
    "#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed",
    "#db2777", "#0d9488", "#ea580c", "#0891b2", "#4f46e5",
    "#65a30d", "#be123c", "#0e7490", "#9333ea", "#c2410c",
]

def mins_to_time(m):
    return f"{m // 60:02d}:{m % 60:02d}"

def day_name(d):
    return DAY_NAMES[d % 7]


def build_html(scenarios):
    parts = [HTML_HEAD]
    parts.append(f'<div class="report-header"><h1>Clocked — Schedule Solver Report</h1>')
    parts.append(f'<p class="report-sub">Generated {datetime.now().strftime("%B %d, %Y at %H:%M")} · {len(scenarios)} scenarios</p></div>')

    for idx, sc in enumerate(scenarios):
        parts.append(render_scenario(sc, idx, len(scenarios)))

    parts.append('</body></html>')
    return '\n'.join(parts)


def render_scenario(sc, idx, total):
    req = sc["request"]
    res = sc.get("response")
    workers = req.get("workers", [])
    covs = req.get("coverage_windows", [])
    unavails = req.get("unavailability", [])
    existing = req.get("existing_assignments", [])
    start_date = datetime.fromisoformat(req["start_date"]).date()
    end_date_val = datetime.fromisoformat(req["end_date"]).date()
    num_days = (end_date_val - start_date).days + 1

    wcolors = {wk["id"]: WORKER_COLORS[i % len(WORKER_COLORS)] for i, wk in enumerate(workers)}
    wnames = {wk["id"]: wk["name"] for wk in workers}

    ua_by_worker = {}
    for ua in unavails:
        ua_by_worker.setdefault(ua["worker_id"], []).append(ua)

    all_skills = sorted(set(c["skill_id"] for c in covs))

    day_cols = []
    for d in range(num_days):
        dt = start_date + timedelta(days=d)
        day_cols.append((d, dt, dt.weekday()))

    h = f'<div class="scenario" id="s{idx}">'
    h += f'<div class="scenario-num">Scenario {idx+1} of {total}</div>'
    h += f'<h2>{sc["title"]}</h2>'
    h += f'<p class="scenario-desc">{sc["description"]}</p>'

    if res:
        status = res.get("status", "?")
        st_class = "st-optimal" if status == "OPTIMAL" else ("st-feasible" if status == "FEASIBLE" else "st-infeasible")
        h += f'<div class="result-bar">'
        h += f'<span class="status-pill {st_class}">{status}</span>'
        h += f'<span class="result-meta">{res.get("solve_time_ms","?")}ms · {len(res.get("assignments",[]))} assignments'
        gaps = res.get("coverage_gaps", [])
        if gaps:
            h += f' · <span class="gap-count">{len(gaps)} gap{"s" if len(gaps)!=1 else ""}</span>'
        h += '</span></div>'

    # ── SECTION 1: Workers Table ──
    h += '<div class="section"><h3>Workers</h3>'
    h += '<table class="data-table"><thead><tr>'
    h += '<th>Worker</th><th>Roles</th><th>Skill Ratings</th><th>Availability</th>'
    h += '</tr></thead><tbody>'
    for wk in workers:
        color = wcolors[wk["id"]]
        h += '<tr>'
        h += f'<td><span class="worker-dot" style="background:{color}"></span><strong>{wk["name"]}</strong></td>'
        h += f'<td>{", ".join(wk["skill_ids"])}</td>'
        h += '<td>'
        for sk in wk["skill_ids"]:
            r = wk.get("skill_ratings", {}).get(sk, "–")
            h += f'<span class="rating-chip">{sk}: <strong>{r}</strong>/10</span> '
        h += '</td>'
        wu = ua_by_worker.get(wk["id"], [])
        if not wu:
            h += '<td class="avail-ok">Available all days</td>'
        else:
            h += '<td class="avail-warn">'
            for ua in wu:
                if ua.get("is_full_day"):
                    h += f'<span class="unavail-tag">Off {day_name(ua["day"])}</span> '
                else:
                    h += (f'<span class="unavail-tag">{day_name(ua["day"])} '
                          f'{mins_to_time(ua.get("start_minutes",0))}–{mins_to_time(ua.get("end_minutes",0))}</span> ')
            h += '</td>'
        h += '</tr>'
    h += '</tbody></table></div>'

    # ── SECTION 2: Manager Requirements ──
    h += '<div class="section"><h3>Manager Requirements</h3>'
    h += '<div class="req-grid">'

    h += '<div class="req-card"><h4>Coverage Windows</h4>'
    h += '<table class="data-table compact"><thead><tr><th>Day</th><th>Time</th><th>Role</th><th>Min Workers</th></tr></thead><tbody>'
    for c in sorted(covs, key=lambda x: (x["day"], x["start_minutes"])):
        h += f'<tr><td>{day_name(c["day"])}</td>'
        h += f'<td>{mins_to_time(c["start_minutes"])} – {mins_to_time(c["end_minutes"])}</td>'
        h += f'<td>{c["skill_id"]}</td>'
        h += f'<td class="center">{c["min_workers"]}</td></tr>'
    h += '</tbody></table></div>'

    settings = req.get("settings", {})
    h += '<div class="req-card"><h4>Schedule Settings</h4><table class="data-table compact">'
    h += f'<tr><td>Max hours/day</td><td class="center"><strong>{settings.get("max_hours_per_day",12)}h</strong></td></tr>'
    h += f'<tr><td>Shift length</td><td class="center"><strong>{settings.get("min_hours_per_block",2)}–{settings.get("max_hours_per_block",10)}h</strong></td></tr>'
    h += f'<tr><td>Min rest between shifts</td><td class="center"><strong>{settings.get("min_rest_between_shifts",8)}h</strong></td></tr>'
    h += f'<tr><td>Granularity</td><td class="center"><strong>{settings.get("granularity_minutes",15)} min</strong></td></tr>'
    h += f'<tr><td>Balance hours</td><td class="center"><strong>{"Yes" if req.get("balance_hours") else "No"}</strong></td></tr>'
    h += f'<tr><td>Minimize changes</td><td class="center"><strong>{"Yes" if req.get("minimize_changes") else "No"}</strong></td></tr>'
    h += '</table>'
    if existing:
        h += '<h4 style="margin-top:12px">Locked Assignments</h4><table class="data-table compact"><thead><tr><th>Worker</th><th>Day</th><th>Role</th><th>Time</th></tr></thead><tbody>'
        for ea in existing:
            wname = wnames.get(ea["worker_id"], ea["worker_id"])
            lock = ' (locked)' if ea.get("is_locked") else ''
            h += f'<tr><td>{wname}{lock}</td><td>{day_name(ea["day"])}</td><td>{ea["skill_id"]}</td>'
            h += f'<td>{mins_to_time(ea["start_minutes"])} – {mins_to_time(ea["end_minutes"])}</td></tr>'
        h += '</tbody></table>'
    h += '</div></div></div>'

    if not res:
        h += '<div class="section"><p class="error-msg">Solver did not return a result.</p></div></div>'
        return h

    # ── SECTION 3: Generated Schedule — Gantt per day ──
    assignments = res.get("assignments", [])
    gaps_list = res.get("coverage_gaps", [])
    hours = res.get("total_hours_by_worker", {})

    h += '<div class="section"><h3>Generated Schedule</h3>'

    if not assignments and not gaps_list:
        h += '<p class="muted">No assignments generated.</p></div></div>'
        return h

    for d, dt, dow in day_cols:
        day_assigns = [a for a in assignments if a["day"] == d]
        day_gaps = [g for g in gaps_list if g["day"] == d]
        day_covs = [c for c in covs if c["day"] == dow]

        if not day_assigns and not day_gaps and not day_covs:
            continue

        # Determine time range for this day
        all_starts = [c["start_minutes"] for c in day_covs]
        all_ends = [c["end_minutes"] for c in day_covs]
        if day_assigns:
            all_starts += [a["start_minutes"] for a in day_assigns]
            all_ends += [a["end_minutes"] for a in day_assigns]
        if not all_starts:
            continue

        day_start = min(all_starts)
        day_end = max(all_ends)
        total_mins = day_end - day_start
        if total_mins <= 0:
            continue

        h += f'<div class="day-chart">'
        h += f'<div class="day-title">{day_name(dow)} — {dt.strftime("%b %d, %Y")}</div>'

        # Group assignments by skill_id
        skills_in_day = sorted(set(
            [c["skill_id"] for c in day_covs] +
            [a["skill_id"] for a in day_assigns]
        ))

        h += '<div class="gantt-container">'

        # Y-axis labels and swimlanes
        for skill in skills_in_day:
            skill_assigns = [a for a in day_assigns if a["skill_id"] == skill]
            skill_gaps = [g for g in day_gaps if g["skill_id"] == skill]
            num_lanes = max(len(skill_assigns), 1)

            h += '<div class="gantt-role-group">'
            h += f'<div class="gantt-role-label" style="height:{max(num_lanes * 38, 38)}px">'
            h += f'<span>{skill}</span></div>'
            h += '<div class="gantt-lanes">'

            for lane_idx, a in enumerate(skill_assigns):
                left_pct = ((a["start_minutes"] - day_start) / total_mins) * 100
                width_pct = ((a["end_minutes"] - a["start_minutes"]) / total_mins) * 100
                color = wcolors.get(a["worker_id"], "#888")
                name = a["worker_name"]
                time_str = f'{mins_to_time(a["start_minutes"])} – {mins_to_time(a["end_minutes"])}'
                rating = "–"
                wobj = next((wk for wk in workers if wk["id"] == a["worker_id"]), None)
                if wobj:
                    rating = wobj.get("skill_ratings", {}).get(a["skill_id"], "–")

                h += (f'<div class="gantt-bar" style="left:{left_pct:.2f}%;width:{width_pct:.2f}%;'
                      f'background:{color}15;border-left:3px solid {color};top:{lane_idx * 38}px">'
                      f'<span class="gantt-bar-name" style="color:{color}">{name}</span>'
                      f'<span class="gantt-bar-time">{time_str}</span>'
                      f'<span class="gantt-bar-rating">★{rating}</span>'
                      f'</div>')

            for g in skill_gaps:
                left_pct = ((g["start_minutes"] - day_start) / total_mins) * 100
                width_pct = ((g["end_minutes"] - g["start_minutes"]) / total_mins) * 100
                lane_top = len(skill_assigns) * 38
                h += (f'<div class="gantt-gap" style="left:{left_pct:.2f}%;width:{width_pct:.2f}%;top:{lane_top}px">'
                      f'GAP: need {g["required"]}, have {g["assigned"]}'
                      f'</div>')

            lane_count = len(skill_assigns) + len(skill_gaps)
            if lane_count == 0:
                lane_count = 1
            h += f'<div style="height:{lane_count * 38}px"></div>'
            h += '</div></div>'

        # X-axis time labels
        h += '<div class="gantt-time-axis">'
        h += '<div class="gantt-role-label"></div>'
        h += '<div class="gantt-time-labels">'
        # Hour marks
        first_hour = day_start // 60
        last_hour = (day_end + 59) // 60
        for hour in range(first_hour, last_hour + 1):
            m = hour * 60
            if m < day_start or m > day_end:
                continue
            left_pct = ((m - day_start) / total_mins) * 100
            h += f'<span class="gantt-hour" style="left:{left_pct:.2f}%">{hour:02d}:00</span>'
        h += '</div></div>'

        h += '</div></div>'

    # ── SECTION 4: Hours & Diagnostics ──
    h += '</div><div class="section"><h3>Hours Distribution & Diagnostics</h3>'
    h += '<div class="req-grid">'

    h += '<div class="req-card"><h4>Hours per Worker</h4>'
    h += '<table class="data-table compact"><thead><tr><th>Worker</th><th>Hours</th><th></th></tr></thead><tbody>'
    max_h = max(hours.values()) if hours and max(hours.values()) > 0 else 1
    for wk in workers:
        wh = hours.get(wk["id"], 0)
        pct = (wh / max_h) * 100 if max_h else 0
        color = wcolors[wk["id"]]
        h += f'<tr><td><span class="worker-dot" style="background:{color}"></span>{wk["name"]}</td>'
        h += f'<td class="center"><strong>{wh:.1f}h</strong></td>'
        h += f'<td class="bar-cell"><div class="bar" style="width:{max(pct,3)}%;background:{color}"></div></td></tr>'
    h += '</tbody></table></div>'

    h += '<div class="req-card"><h4>Solver Diagnostics</h4><ul class="diag-list">'
    for dg in res.get("diagnostics", []):
        h += f'<li>{dg}</li>'
    h += '</ul>'

    if gaps_list:
        h += f'<h4 class="gap-title">Coverage Gaps ({len(gaps_list)})</h4>'
        h += '<table class="data-table compact"><thead><tr><th>Day</th><th>Time</th><th>Role</th><th>Need</th><th>Have</th></tr></thead><tbody>'
        for g in gaps_list:
            gday = g["day"]
            h += f'<tr class="gap-row"><td>Day {gday}</td>'
            h += f'<td>{mins_to_time(g["start_minutes"])}–{mins_to_time(g["end_minutes"])}</td>'
            h += f'<td>{g["skill_id"]}</td><td class="center">{g["required"]}</td><td class="center">{g["assigned"]}</td></tr>'
        h += '</tbody></table>'

    h += '</div></div></div>'
    h += '</div>'
    return h


# ─── HTML Template ─────────────────────────────────────────────────────────────

HTML_HEAD = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Clocked — Schedule Solver Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
    background: #ffffff; color: #1a1a1a; line-height: 1.55; padding: 0;
  }
  .report-header {
    padding: 40px 48px 32px; border-bottom: 1px solid #e5e5e5;
  }
  .report-header h1 { font-size: 28px; font-weight: 700; color: #111; }
  .report-sub { color: #888; font-size: 14px; margin-top: 4px; }

  .scenario {
    padding: 32px 48px 40px;
    border-bottom: 2px solid #e5e5e5;
  }
  .scenario:last-child { border-bottom: none; }
  .scenario-num { font-size: 12px; font-weight: 600; color: #aaa; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
  .scenario h2 { font-size: 22px; font-weight: 700; color: #111; margin-bottom: 6px; }
  .scenario-desc { color: #555; font-size: 14px; margin-bottom: 16px; max-width: 800px; }

  .result-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding: 10px 16px;
                background: #fafafa; border: 1px solid #eee; border-radius: 8px; }
  .status-pill { padding: 4px 14px; border-radius: 5px; font-size: 13px; font-weight: 700; color: #fff; }
  .st-optimal { background: #16a34a; }
  .st-feasible { background: #d97706; }
  .st-infeasible { background: #dc2626; }
  .result-meta { font-size: 13px; color: #666; }
  .gap-count { color: #dc2626; font-weight: 600; }

  .section { margin-bottom: 24px; }
  .section h3 { font-size: 15px; font-weight: 700; color: #333; text-transform: uppercase;
                letter-spacing: 0.04em; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #eee; }

  .data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .data-table th { text-align: left; padding: 8px 12px; background: #f8f8f8; color: #555;
                   font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;
                   border-bottom: 2px solid #eee; }
  .data-table td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  .data-table.compact td, .data-table.compact th { padding: 6px 10px; }
  .data-table tbody tr:hover { background: #fafafa; }
  .center { text-align: center; }

  .worker-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }

  .rating-chip { display: inline-block; padding: 2px 8px; background: #f5f5f5; border: 1px solid #e5e5e5;
                 border-radius: 4px; font-size: 12px; margin: 1px 2px; color: #333; }

  .avail-ok { color: #16a34a; }
  .avail-warn { }
  .unavail-tag { display: inline-block; padding: 2px 8px; background: #fef2f2; border: 1px solid #fecaca;
                 border-radius: 4px; font-size: 12px; color: #dc2626; margin: 1px 2px; }

  .req-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  @media (max-width: 900px) { .req-grid { grid-template-columns: 1fr; } }
  .req-card { background: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: 16px; }
  .req-card h4 { font-size: 13px; font-weight: 700; color: #444; margin-bottom: 8px; }

  /* ── Gantt Chart ── */
  .day-chart {
    margin-bottom: 24px;
    border: 1px solid #e5e5e5;
    border-radius: 10px;
    overflow: hidden;
    background: #fff;
  }
  .day-title {
    padding: 12px 20px;
    font-size: 16px;
    font-weight: 700;
    color: #111;
    background: #f8f8f8;
    border-bottom: 1px solid #e5e5e5;
  }
  .gantt-container {
    padding: 0;
  }
  .gantt-role-group {
    display: flex;
    border-bottom: 1px solid #f0f0f0;
  }
  .gantt-role-group:last-of-type {
    border-bottom: none;
  }
  .gantt-role-label {
    width: 100px;
    min-width: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    color: #555;
    background: #fafafa;
    border-right: 1px solid #e5e5e5;
    padding: 8px 6px;
    text-align: center;
    writing-mode: vertical-lr;
    transform: rotate(180deg);
    letter-spacing: 0.03em;
  }
  .gantt-lanes {
    flex: 1;
    position: relative;
    min-height: 38px;
  }
  .gantt-bar {
    position: absolute;
    height: 34px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px;
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    margin: 2px 0;
  }
  .gantt-bar-name {
    font-weight: 700;
    font-size: 13px;
  }
  .gantt-bar-time {
    color: #666;
    font-size: 11px;
  }
  .gantt-bar-rating {
    color: #999;
    font-size: 11px;
  }
  .gantt-gap {
    position: absolute;
    height: 34px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    padding: 0 10px;
    font-size: 11px;
    background: #fef2f2;
    border: 1px dashed #fca5a5;
    color: #dc2626;
    white-space: nowrap;
    margin: 2px 0;
  }

  /* Time axis */
  .gantt-time-axis {
    display: flex;
    border-top: 1px solid #e5e5e5;
    background: #fafafa;
  }
  .gantt-time-labels {
    flex: 1;
    position: relative;
    height: 28px;
  }
  .gantt-hour {
    position: absolute;
    font-size: 11px;
    color: #999;
    transform: translateX(-50%);
    top: 6px;
    font-weight: 500;
  }

  /* Hours bar */
  .bar-cell { width: 200px; }
  .bar { height: 18px; border-radius: 3px; min-width: 4px; }

  .diag-list { list-style: none; padding: 0; }
  .diag-list li { padding: 4px 0; font-size: 13px; color: #555; }
  .diag-list li::before { content: "-> "; color: #aaa; }
  .gap-title { color: #dc2626; margin-top: 16px; }
  .gap-row td { color: #dc2626; }

  .muted { color: #ccc; }
  .error-msg { color: #dc2626; padding: 12px; background: #fef2f2; border-radius: 6px; }

  @media print {
    .scenario { break-inside: avoid; page-break-inside: avoid; }
    body { padding: 0; }
    .report-header { padding: 20px; }
    .scenario { padding: 20px; }
  }
</style>
</head>
<body>
"""


# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    try:
        resp = requests.get(f"{SOLVER_URL}/health", timeout=5)
        print(f"OK Solver running: {resp.json()}")
    except requests.ConnectionError:
        print(f"X Solver not running at {SOLVER_URL}")
        print("  Start it: cd solver && python main.py")
        return

    scenarios = []
    for fn in ALL_SCENARIOS:
        sc = fn()
        print(f"  Solving: {sc['title']}...", end=" ", flush=True)
        try:
            resp = requests.post(f"{SOLVER_URL}/solve", json=sc["request"], timeout=60)
            if resp.status_code == 200:
                sc["response"] = resp.json()
                status = sc["response"]["status"]
                ms = sc["response"]["solve_time_ms"]
                n = len(sc["response"]["assignments"])
                print(f"OK {status} - {n} assignments - {ms}ms")
            else:
                sc["response"] = None
                print(f"X HTTP {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            sc["response"] = None
            print(f"X {e}")
        scenarios.append(sc)

    html = build_html(scenarios)
    out = Path(__file__).parent / "schedule_report.html"
    out.write_text(html, encoding="utf-8")
    print(f"\nOK Report saved to: {out}")
    webbrowser.open(f"file://{out.resolve()}")

if __name__ == "__main__":
    main()
