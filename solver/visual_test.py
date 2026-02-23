"""
Visual Solver Report v2 — Gantt-chart style schedule per day.
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
    "#1d4ed8", "#b91c1c", "#15803d", "#b45309", "#6d28d9",
]

def mins_to_time(m):
    h = int(m) // 60
    mn = int(m) % 60
    return f"{h:02d}:{mn:02d}"

def day_name(d):
    return DAY_NAMES[d % 7]


def build_html(scenarios):
    parts = [HTML_HEAD]
    parts.append('<div class="report-header">')
    parts.append('<h1>Clocked — Schedule Solver v2 Report</h1>')
    parts.append(f'<p class="report-sub">Generated {datetime.now().strftime("%B %d, %Y at %H:%M")} &nbsp;·&nbsp; {len(scenarios)} scenarios &nbsp;·&nbsp; Flexible shift model</p>')
    parts.append('<p class="report-sub v2-badge">Solver v2: cross-window shifts · partial handoffs · proportional hour balancing · shift-length optimisation</p>')
    parts.append('</div>')
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

    day_cols = [(d, start_date + timedelta(days=d)) for d in range(num_days)]

    is_v2 = "[V2]" in sc["title"]
    v2_tag = ' <span class="v2-tag">V2 Feature</span>' if is_v2 else ""

    h = f'<div class="scenario" id="s{idx}">'
    h += f'<div class="scenario-num">Scenario {idx+1} of {total}</div>'
    h += f'<h2>{sc["title"]}{v2_tag}</h2>'
    h += f'<p class="scenario-desc">{sc["description"]}</p>'

    if res:
        status = res.get("status", "?")
        st_class = "st-optimal" if status == "OPTIMAL" else ("st-feasible" if status == "FEASIBLE" else "st-infeasible")
        gaps = res.get("coverage_gaps", [])
        h += '<div class="result-bar">'
        h += f'<span class="status-pill {st_class}">{status}</span>'
        h += f'<span class="result-meta">{res.get("solve_time_ms","?")}ms · {len(res.get("assignments",[]))} assignments'
        if gaps:
            h += f' · <span class="gap-count">{len(gaps)} gap{"s" if len(gaps)!=1 else ""}</span>'
        h += '</span></div>'

    # Workers table
    h += '<div class="section"><h3>Workers</h3>'
    h += '<table class="data-table"><thead><tr><th>Worker</th><th>Roles</th><th>Skill Ratings</th><th>Availability Constraints</th></tr></thead><tbody>'
    for wk in workers:
        color = wcolors[wk["id"]]
        wu = ua_by_worker.get(wk["id"], [])
        h += '<tr>'
        h += f'<td><span class="worker-dot" style="background:{color}"></span><strong>{wk["name"]}</strong></td>'
        h += f'<td>{", ".join(wk["skill_ids"])}</td>'
        h += '<td>' + "".join(
            f'<span class="rating-chip">{sk}: <strong>{wk.get("skill_ratings",{}).get(sk,"–")}</strong>/10</span>'
            for sk in wk["skill_ids"]
        ) + '</td>'
        if not wu:
            h += '<td class="avail-ok">Available all days</td>'
        else:
            h += '<td class="avail-warn">' + "".join(
                f'<span class="unavail-tag">Off {day_name(ua["day"])}</span>'
                if ua.get("is_full_day") else
                f'<span class="unavail-tag">{day_name(ua["day"])} {mins_to_time(ua.get("start_minutes",0))}–{mins_to_time(ua.get("end_minutes",0))}</span>'
                for ua in wu
            ) + '</td>'
        h += '</tr>'
    h += '</tbody></table></div>'

    # Requirements card
    settings = req.get("settings", {})
    h += '<div class="section"><h3>Manager Requirements</h3><div class="req-grid">'
    h += '<div class="req-card"><h4>Coverage Windows</h4>'
    h += '<table class="data-table compact"><thead><tr><th>Day</th><th>Time</th><th>Role</th><th>Min</th></tr></thead><tbody>'
    for c in sorted(covs, key=lambda x: (x["day"], x["start_minutes"])):
        h += (f'<tr><td>Day {c["day"]}</td>'
              f'<td>{mins_to_time(c["start_minutes"])} – {mins_to_time(c["end_minutes"])}</td>'
              f'<td>{c["skill_id"]}</td><td class="center">{c["min_workers"]}</td></tr>')
    h += '</tbody></table></div>'
    h += '<div class="req-card"><h4>Schedule Settings</h4><table class="data-table compact">'
    h += f'<tr><td>Shift length</td><td class="center"><strong>{settings.get("min_hours_per_block",2)}h – {settings.get("max_hours_per_block",8)}h</strong></td></tr>'
    h += f'<tr><td>Max hours/day</td><td class="center"><strong>{settings.get("max_hours_per_day",12)}h</strong></td></tr>'
    h += f'<tr><td>Granularity</td><td class="center"><strong>{settings.get("granularity_minutes",30)} min</strong></td></tr>'
    h += f'<tr><td>Balance hours</td><td class="center"><strong>{"Yes" if req.get("balance_hours") else "No"}</strong></td></tr>'
    h += f'<tr><td>Minimise changes</td><td class="center"><strong>{"Yes" if req.get("minimize_changes") else "No"}</strong></td></tr>'
    h += '</table>'
    if existing:
        h += '<h4 style="margin-top:12px">Existing Assignments</h4>'
        h += '<table class="data-table compact"><thead><tr><th>Worker</th><th>Day</th><th>Role</th><th>Time</th><th>Locked</th></tr></thead><tbody>'
        for ea in existing:
            lock = "🔒" if ea.get("is_locked") else "–"
            h += (f'<tr><td>{wnames.get(ea["worker_id"], ea["worker_id"])}</td>'
                  f'<td>Day {ea["day"]}</td><td>{ea["skill_id"]}</td>'
                  f'<td>{mins_to_time(ea["start_minutes"])} – {mins_to_time(ea["end_minutes"])}</td>'
                  f'<td class="center">{lock}</td></tr>')
        h += '</tbody></table>'
    h += '</div></div></div>'

    if not res:
        h += '<div class="section"><p class="error-msg">Solver did not return a result.</p></div></div>'
        return h

    # Gantt chart
    assignments = res.get("assignments", [])
    gaps_list = res.get("coverage_gaps", [])
    hours = res.get("total_hours_by_worker", {})

    h += '<div class="section"><h3>Generated Schedule</h3>'

    for d, dt in day_cols:
        day_assigns = [a for a in assignments if a["day"] == d]
        day_gaps = [g for g in gaps_list if g["day"] == d]
        day_covs = [c for c in covs if c["day"] == d]
        if not day_assigns and not day_gaps and not day_covs:
            continue

        all_starts = [c["start_minutes"] for c in day_covs] + [a["start_minutes"] for a in day_assigns]
        all_ends   = [c["end_minutes"]   for c in day_covs] + [a["end_minutes"]   for a in day_assigns]
        if not all_starts:
            continue
        day_start = min(all_starts)
        day_end   = max(all_ends)
        total_mins = day_end - day_start
        if total_mins <= 0:
            continue

        h += f'<div class="day-chart">'
        h += f'<div class="day-title">Day {d} — {dt.strftime("%A, %b %d, %Y")}</div>'
        h += '<div class="gantt-container">'

        skills_in_day = sorted(set(
            [c["skill_id"] for c in day_covs] + [a["skill_id"] for a in day_assigns]
        ))

        for skill in skills_in_day:
            skill_assigns = [a for a in day_assigns if a["skill_id"] == skill]
            skill_gaps    = [g for g in day_gaps    if g["skill_id"] == skill]
            skill_covs    = [c for c in day_covs    if c["skill_id"] == skill]

            num_lanes = max(len(skill_assigns) + len(skill_gaps), 1)
            h += '<div class="gantt-role-group">'
            h += f'<div class="gantt-role-label" style="height:{num_lanes * 38 + 4}px"><span>{skill}</span></div>'
            h += '<div class="gantt-lanes">'

            # Coverage demand shading
            for c in skill_covs:
                lp = ((c["start_minutes"] - day_start) / total_mins) * 100
                wp = ((c["end_minutes"] - c["start_minutes"]) / total_mins) * 100
                c_min_w = c["min_workers"]
                c_t0 = mins_to_time(c["start_minutes"])
                c_t1 = mins_to_time(c["end_minutes"])
                h += (f'<div class="gantt-demand" style="left:{lp:.2f}%;width:{wp:.2f}%;'
                      f'height:{num_lanes * 38}px" title="Demand: {c_min_w} worker(s) {c_t0}–{c_t1}"></div>')

            for lane_idx, a in enumerate(skill_assigns):
                lp = ((a["start_minutes"] - day_start) / total_mins) * 100
                wp = ((a["end_minutes"] - a["start_minutes"]) / total_mins) * 100
                color = wcolors.get(a["worker_id"], "#888")
                wobj = next((wk for wk in workers if wk["id"] == a["worker_id"]), None)
                rating = wobj.get("skill_ratings", {}).get(a["skill_id"], "–") if wobj else "–"
                time_str = f'{mins_to_time(a["start_minutes"])} – {mins_to_time(a["end_minutes"])}'
                dur_h = (a["end_minutes"] - a["start_minutes"]) / 60
                h += (f'<div class="gantt-bar" style="left:{lp:.2f}%;width:{wp:.2f}%;'
                      f'background:{color}18;border-left:3px solid {color};top:{lane_idx*38+2}px">'
                      f'<span class="gantt-bar-name" style="color:{color}">{a["worker_name"]}</span>'
                      f'<span class="gantt-bar-time">{time_str}</span>'
                      f'<span class="gantt-bar-dur">{dur_h:.1f}h</span>'
                      f'<span class="gantt-bar-rating">★{rating}</span>'
                      f'</div>')

            for g_idx, g in enumerate(skill_gaps):
                lp = ((g["start_minutes"] - day_start) / total_mins) * 100
                wp = ((g["end_minutes"] - g["start_minutes"]) / total_mins) * 100
                top = (len(skill_assigns) + g_idx) * 38 + 2
                h += (f'<div class="gantt-gap" style="left:{lp:.2f}%;width:{wp:.2f}%;top:{top}px">'
                      f'GAP: need {g["required"]}, have {g["assigned"]}</div>')

            h += f'<div style="height:{num_lanes*38+4}px"></div>'
            h += '</div></div>'

        # Time axis
        h += '<div class="gantt-time-axis"><div class="gantt-role-label"></div><div class="gantt-time-labels">'
        for hour in range(day_start // 60, day_end // 60 + 1):
            m = hour * 60
            if m < day_start or m > day_end:
                continue
            lp = ((m - day_start) / total_mins) * 100
            h += f'<span class="gantt-hour" style="left:{lp:.2f}%">{hour:02d}:00</span>'
        h += '</div></div>'
        h += '</div></div>'

    # Hours & diagnostics
    h += '</div><div class="section"><h3>Hours Distribution &amp; Diagnostics</h3><div class="req-grid">'

    h += '<div class="req-card"><h4>Hours per Worker</h4>'
    h += '<table class="data-table compact"><thead><tr><th>Worker</th><th>Hours</th><th></th></tr></thead><tbody>'
    max_h = max(hours.values()) if hours and max(hours.values()) > 0 else 1
    for wk in workers:
        wh = hours.get(wk["id"], 0)
        pct = (wh / max_h) * 100
        color = wcolors[wk["id"]]
        h += (f'<tr><td><span class="worker-dot" style="background:{color}"></span>{wk["name"]}</td>'
              f'<td class="center"><strong>{wh:.1f}h</strong></td>'
              f'<td class="bar-cell"><div class="bar" style="width:{max(pct,2)}%;background:{color}"></div></td></tr>')
    h += '</tbody></table></div>'

    h += '<div class="req-card"><h4>Solver Diagnostics</h4><ul class="diag-list">'
    for dg in res.get("diagnostics", []):
        h += f'<li>{dg}</li>'
    h += '</ul>'
    if gaps_list:
        h += f'<h4 class="gap-title">Coverage Gaps ({len(gaps_list)})</h4>'
        h += '<table class="data-table compact"><thead><tr><th>Day</th><th>Time</th><th>Role</th><th>Need</th><th>Have</th></tr></thead><tbody>'
        for g in gaps_list:
            h += (f'<tr class="gap-row"><td>Day {g["day"]}</td>'
                  f'<td>{mins_to_time(g["start_minutes"])}–{mins_to_time(g["end_minutes"])}</td>'
                  f'<td>{g["skill_id"]}</td><td class="center">{g["required"]}</td>'
                  f'<td class="center">{g["assigned"]}</td></tr>')
        h += '</tbody></table>'
    h += '</div></div></div>'
    h += '</div>'
    return h


HTML_HEAD = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Clocked — Schedule Solver v2 Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         background: #fff; color: #1a1a1a; line-height: 1.55; }
  .report-header { padding: 40px 48px 28px; border-bottom: 1px solid #e5e5e5; }
  .report-header h1 { font-size: 28px; font-weight: 700; color: #111; }
  .report-sub { color: #888; font-size: 14px; margin-top: 4px; }
  .v2-badge { color: #2563eb; font-size: 13px; margin-top: 6px; font-weight: 500; }

  .scenario { padding: 32px 48px 40px; border-bottom: 2px solid #e5e5e5; }
  .scenario:last-child { border-bottom: none; }
  .scenario-num { font-size: 12px; font-weight: 600; color: #aaa; text-transform: uppercase;
                  letter-spacing: .06em; margin-bottom: 4px; }
  .scenario h2 { font-size: 22px; font-weight: 700; color: #111; margin-bottom: 6px; }
  .scenario-desc { color: #555; font-size: 14px; margin-bottom: 16px; max-width: 820px; }
  .v2-tag { display: inline-block; padding: 2px 10px; background: #eff6ff; border: 1px solid #bfdbfe;
            border-radius: 5px; font-size: 11px; font-weight: 700; color: #2563eb;
            vertical-align: middle; margin-left: 8px; }

  .result-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 20px;
                padding: 10px 16px; background: #fafafa; border: 1px solid #eee; border-radius: 8px; }
  .status-pill { padding: 4px 14px; border-radius: 5px; font-size: 13px; font-weight: 700; color: #fff; }
  .st-optimal { background: #16a34a; } .st-feasible { background: #d97706; } .st-infeasible { background: #dc2626; }
  .result-meta { font-size: 13px; color: #666; }
  .gap-count { color: #dc2626; font-weight: 600; }

  .section { margin-bottom: 24px; }
  .section h3 { font-size: 14px; font-weight: 700; color: #333; text-transform: uppercase;
                letter-spacing: .04em; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #eee; }

  .data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .data-table th { text-align: left; padding: 8px 12px; background: #f8f8f8; color: #555;
                   font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .04em;
                   border-bottom: 2px solid #eee; }
  .data-table td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  .data-table.compact td, .data-table.compact th { padding: 6px 10px; }
  .data-table tbody tr:hover { background: #fafafa; }
  .center { text-align: center; }

  .worker-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%;
                margin-right: 6px; vertical-align: middle; }
  .rating-chip { display: inline-block; padding: 2px 8px; background: #f5f5f5; border: 1px solid #e5e5e5;
                 border-radius: 4px; font-size: 12px; margin: 1px 2px; }
  .avail-ok { color: #16a34a; }
  .unavail-tag { display: inline-block; padding: 2px 8px; background: #fef2f2; border: 1px solid #fecaca;
                 border-radius: 4px; font-size: 12px; color: #dc2626; margin: 1px 2px; }

  .req-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  @media (max-width: 900px) { .req-grid { grid-template-columns: 1fr; } }
  .req-card { background: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: 16px; }
  .req-card h4 { font-size: 13px; font-weight: 700; color: #444; margin-bottom: 8px; }

  /* Gantt */
  .day-chart { margin-bottom: 24px; border: 1px solid #e5e5e5; border-radius: 10px;
               overflow: hidden; background: #fff; }
  .day-title { padding: 12px 20px; font-size: 15px; font-weight: 700; color: #111;
               background: #f8f8f8; border-bottom: 1px solid #e5e5e5; }
  .gantt-container { padding: 0; }
  .gantt-role-group { display: flex; border-bottom: 1px solid #f0f0f0; }
  .gantt-role-group:last-of-type { border-bottom: none; }
  .gantt-role-label { width: 110px; min-width: 110px; display: flex; align-items: center;
                      justify-content: center; font-size: 12px; font-weight: 700; color: #555;
                      background: #fafafa; border-right: 1px solid #e5e5e5; padding: 8px 4px;
                      text-align: center; writing-mode: vertical-lr; transform: rotate(180deg);
                      letter-spacing: .03em; }
  .gantt-lanes { flex: 1; position: relative; min-height: 42px; }
  .gantt-demand { position: absolute; top: 0; background: #f0f9ff; border-left: 2px dashed #bae6fd;
                  border-right: 2px dashed #bae6fd; pointer-events: none; }
  .gantt-bar { position: absolute; height: 34px; border-radius: 6px; display: flex; align-items: center;
               gap: 6px; padding: 0 10px; font-size: 12px; white-space: nowrap; overflow: hidden; }
  .gantt-bar-name { font-weight: 700; font-size: 13px; }
  .gantt-bar-time { color: #666; font-size: 11px; }
  .gantt-bar-dur  { color: #888; font-size: 11px; background: #f5f5f5; padding: 1px 5px; border-radius: 3px; }
  .gantt-bar-rating { color: #bbb; font-size: 11px; }
  .gantt-gap { position: absolute; height: 34px; border-radius: 6px; display: flex; align-items: center;
               padding: 0 10px; font-size: 11px; background: #fef2f2; border: 1px dashed #fca5a5;
               color: #dc2626; white-space: nowrap; }
  .gantt-time-axis { display: flex; border-top: 1px solid #e5e5e5; background: #fafafa; }
  .gantt-time-labels { flex: 1; position: relative; height: 28px; }
  .gantt-hour { position: absolute; font-size: 11px; color: #999; transform: translateX(-50%);
                top: 6px; font-weight: 500; }

  .bar-cell { width: 200px; }
  .bar { height: 18px; border-radius: 3px; min-width: 4px; }
  .diag-list { list-style: none; padding: 0; }
  .diag-list li { padding: 4px 0; font-size: 13px; color: #555; }
  .diag-list li::before { content: "→ "; color: #aaa; }
  .gap-title { color: #dc2626; margin-top: 16px; font-size: 13px; font-weight: 700; }
  .gap-row td { color: #dc2626; }
  .muted { color: #ccc; }
  .error-msg { color: #dc2626; padding: 12px; background: #fef2f2; border-radius: 6px; }
  @media print { .scenario { break-inside: avoid; } }
</style>
</head>
<body>
"""


def main():
    try:
        resp = requests.get(f"{SOLVER_URL}/health", timeout=5)
        info = resp.json()
        print(f"OK Solver running: {info}")
    except requests.ConnectionError:
        print(f"X Solver not running at {SOLVER_URL}")
        print("  Start it: cd solver && python main.py")
        return

    scenarios = []
    for fn in ALL_SCENARIOS:
        sc = fn()
        print(f"  [{len(scenarios)+1:02d}/30] {sc['title']} ...", end=" ", flush=True)
        try:
            resp = requests.post(f"{SOLVER_URL}/solve", json=sc["request"], timeout=90)
            if resp.status_code == 200:
                sc["response"] = resp.json()
                r = sc["response"]
                print(f"{r['status']} · {len(r['assignments'])} shifts · {r['solve_time_ms']}ms")
            else:
                sc["response"] = None
                print(f"HTTP {resp.status_code}: {resp.text[:120]}")
        except Exception as e:
            sc["response"] = None
            print(f"ERR {e}")
        scenarios.append(sc)

    html = build_html(scenarios)
    out = Path(__file__).parent / "schedule_report.html"
    out.write_text(html, encoding="utf-8")
    print(f"\nOK Report saved → {out}")
    webbrowser.open(f"file://{out.resolve()}")


if __name__ == "__main__":
    main()
