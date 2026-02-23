"""
March 2026 — Full Month Schedule Test

Generates a 31-day scenario for a single venue with 6 workers,
calls the solver, and produces march_report.html with:
  1. Month-overview calendar (green/red per day)
  2. Per-day Gantt charts with worker bars and gap indicators
"""

import requests
import webbrowser
from datetime import date, timedelta
from pathlib import Path

SOLVER_URL = "http://localhost:8000"
START = date(2026, 3, 1)  # Sunday
NUM_DAYS = 31

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

WORKER_COLORS = {
    "toms":    "#2563eb",
    "emils":   "#dc2626",
    "reinis":  "#16a34a",
    "atis":    "#d97706",
    "gustavs": "#7c3aed",
    "tanya":   "#db2777",
}
WORKER_ORDER = ["toms", "emils", "reinis", "atis", "gustavs", "tanya"]
WORKER_NAMES = {
    "toms": "Toms", "emils": "Emīls", "reinis": "Reinis",
    "atis": "Atis", "gustavs": "Gustavs", "tanya": "Tanya",
}


def wd(d):
    """Weekday index for day offset d (Mon=0 … Sun=6)."""
    return (START + timedelta(days=d)).weekday()


def day_date(d):
    return START + timedelta(days=d)


def mins_to_time(m):
    return f"{int(m)//60:02d}:{int(m)%60:02d}"


# ── Scenario builder ──────────────────────────────────────────────────────────

def build_scenario():
    workers = [
        {"id": wid, "name": WORKER_NAMES[wid], "skill_ids": ["Staff"],
         "place_ids": ["place-1"], "skill_ratings": {"Staff": 7}}
        for wid in WORKER_ORDER
    ]

    # Coverage windows
    coverage = []
    for d in range(NUM_DAYS):
        w = wd(d)
        is_weekend = w in (5, 6)         # Sat / Sun
        is_peak_day = w in (3, 4, 5)     # Thu / Fri / Sat

        # 10-12 opener (brunch on weekends → 2)
        coverage.append({
            "id": f"morning-{d}", "skill_id": "Staff", "day": d,
            "start_minutes": 600, "end_minutes": 720,
            "min_workers": 2 if is_weekend else 1,
        })
        # 12-18 midday
        coverage.append({
            "id": f"midday-{d}", "skill_id": "Staff", "day": d,
            "start_minutes": 720, "end_minutes": 1080, "min_workers": 2,
        })
        # 18-21 peak
        coverage.append({
            "id": f"peak-{d}", "skill_id": "Staff", "day": d,
            "start_minutes": 1080, "end_minutes": 1260,
            "min_workers": 4 if is_peak_day else 3,
        })
        # 21-22 closing
        coverage.append({
            "id": f"close-{d}", "skill_id": "Staff", "day": d,
            "start_minutes": 1260, "end_minutes": 1320, "min_workers": 2,
        })

    # Unavailability
    unavail = []

    # Toms: off 9th (d=8), 14th (d=13), 25-27th (d=24..26)
    for d in [8, 13, 24, 25, 26]:
        unavail.append({"worker_id": "toms", "day": d, "is_full_day": True})

    # Emīls: available only Wed / Sat / Sun
    for d in range(NUM_DAYS):
        if wd(d) not in (2, 5, 6):
            unavail.append({"worker_id": "emils", "day": d, "is_full_day": True})

    # Reinis: weekdays until 19:00, off Sat/Sun
    for d in range(NUM_DAYS):
        if wd(d) in (5, 6):
            unavail.append({"worker_id": "reinis", "day": d, "is_full_day": True})
        else:
            unavail.append({"worker_id": "reinis", "day": d,
                            "start_minutes": 1140, "end_minutes": 1440, "is_full_day": False})

    # Atis: off Mar 1-5 (d=0..4) and Mar 19-22 (d=18..21)
    for d in list(range(0, 5)) + list(range(18, 22)):
        unavail.append({"worker_id": "atis", "day": d, "is_full_day": True})

    # Gustavs: working days from 12:00, weekends all day, off Mar 16 (d=15)
    unavail.append({"worker_id": "gustavs", "day": 15, "is_full_day": True})
    for d in range(NUM_DAYS):
        if d == 15:
            continue
        if wd(d) in (0, 1, 2, 3, 4):  # Mon-Fri
            unavail.append({"worker_id": "gustavs", "day": d,
                            "start_minutes": 0, "end_minutes": 720, "is_full_day": False})

    # Tanya: Mon all day, Tue off, Wed until 14:00, Thu all day, Fri until 18:00, Sat/Sun all day
    for d in range(NUM_DAYS):
        w = wd(d)
        if w == 1:  # Tuesday
            unavail.append({"worker_id": "tanya", "day": d, "is_full_day": True})
        elif w == 2:  # Wednesday → available until 14:00
            unavail.append({"worker_id": "tanya", "day": d,
                            "start_minutes": 840, "end_minutes": 1440, "is_full_day": False})
        elif w == 4:  # Friday → available until 18:00
            unavail.append({"worker_id": "tanya", "day": d,
                            "start_minutes": 1080, "end_minutes": 1440, "is_full_day": False})

    return {
        "place_id": "place-1",
        "start_date": "2026-03-01",
        "end_date": "2026-03-31",
        "workers": workers,
        "coverage_windows": coverage,
        "unavailability": unavail,
        "settings": {
            "max_hours_per_day": 12,
            "min_hours_per_block": 2,
            "max_hours_per_block": 12,
            "soft_min_hours_per_block": 4,
            "soft_max_hours_per_block": 8,
            "min_rest_between_shifts": 8,
            "granularity_minutes": 30,
        },
        "balance_hours": True,
        "minimize_changes": False,
        "solver_timeout_seconds": 120,
    }


# ── HTML generator ────────────────────────────────────────────────────────────

def build_html(scenario, response):
    assignments = response.get("assignments", [])
    gaps = response.get("coverage_gaps", [])
    hours = response.get("total_hours_by_worker", {})
    covs = scenario["coverage_windows"]
    unavails = scenario["unavailability"]

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

    # Header
    parts.append('<div class="report-header">')
    parts.append('<h1>March 2026 — Monthly Schedule</h1>')
    parts.append(f'<p class="sub">{response["status"]} · {len(assignments)} shifts · '
                 f'{len(gaps)} gaps · {response["solve_time_ms"]}ms</p>')
    parts.append('</div>')

    # ── Month overview calendar ──────────────────────────────────────────────
    parts.append('<div class="section month-section"><h2>Month Overview</h2>')
    parts.append('<div class="month-grid">')
    parts.append('<div class="month-header">')
    for dn in DAY_SHORT:
        parts.append(f'<span>{dn}</span>')
    parts.append('</div>')

    first_wd = START.weekday()  # 6 for Sunday
    cell_idx = 0
    day_ptr = 0

    parts.append('<div class="month-row">')
    # Leading empties
    for _ in range(first_wd):
        parts.append('<div class="day-cell empty"></div>')
        cell_idx += 1

    for d in range(NUM_DAYS):
        if cell_idx > 0 and cell_idx % 7 == 0:
            parts.append('</div><div class="month-row">')
        info = day_info[d]
        dt = day_date(d)
        cls = "day-cell ok" if info["ok"] else "day-cell gap"
        gap_label = ""
        if not info["ok"]:
            gh = info["gap_mins"] / 60
            gap_label = f'<span class="gap-badge">{gh:.1f}h gap</span>'
        parts.append(
            f'<a href="#day-{d}" class="{cls}">'
            f'<span class="day-num">{dt.day}</span>'
            f'<span class="day-wd">{DAY_SHORT[dt.weekday()]}</span>'
            f'{gap_label}</a>'
        )
        cell_idx += 1

    # Trailing empties
    while cell_idx % 7 != 0:
        parts.append('<div class="day-cell empty"></div>')
        cell_idx += 1
    parts.append('</div>')  # last row
    parts.append('</div>')  # month-grid
    parts.append('</div>')  # section

    # ── Worker summary ───────────────────────────────────────────────────────
    parts.append('<div class="section"><h2>Worker Hours Summary</h2>')
    parts.append('<div class="worker-summary">')
    max_h = max(hours.values()) if hours and max(hours.values()) > 0 else 1
    for wid in WORKER_ORDER:
        wh = hours.get(wid, 0)
        pct = (wh / max_h) * 100
        color = WORKER_COLORS[wid]
        parts.append(
            f'<div class="ws-row">'
            f'<span class="ws-name"><span class="dot" style="background:{color}"></span>{WORKER_NAMES[wid]}</span>'
            f'<span class="ws-hours">{wh:.1f}h</span>'
            f'<div class="ws-bar"><div class="ws-fill" style="width:{max(pct,2):.1f}%;background:{color}"></div></div>'
            f'</div>'
        )
    parts.append('</div></div>')

    # ── Per-day detail ───────────────────────────────────────────────────────
    parts.append('<div class="section"><h2>Daily Schedule Details</h2></div>')

    for d in range(NUM_DAYS):
        info = day_info[d]
        dt = day_date(d)
        status_cls = "day-ok" if info["ok"] else "day-gap"
        parts.append(f'<div class="day-detail {status_cls}" id="day-{d}">')
        parts.append(f'<div class="day-header">')
        parts.append(f'<h3>March {dt.day} — {DAY_NAMES[dt.weekday()]}</h3>')
        if not info["ok"]:
            gh = info["gap_mins"] / 60
            parts.append(f'<span class="day-gap-badge">{len(info["gaps"])} gap{"s" if len(info["gaps"])!=1 else ""} ({gh:.1f}h)</span>')
        else:
            parts.append('<span class="day-ok-badge">✓ Fully covered</span>')
        parts.append('</div>')

        # Availability row
        parts.append('<div class="avail-row">')
        for wid in WORKER_ORDER:
            uas = ua_by_worker_day.get((wid, d), [])
            color = WORKER_COLORS[wid]
            if any(ua.get("is_full_day") for ua in uas):
                parts.append(f'<span class="avail-chip off"><span class="dot" style="background:{color}"></span>{WORKER_NAMES[wid]}: Off</span>')
            elif uas:
                constraints = []
                for ua in uas:
                    if not ua.get("is_full_day") and ua.get("start_minutes") is not None:
                        constraints.append(f'{mins_to_time(ua["start_minutes"])}–{mins_to_time(ua["end_minutes"])}')
                cstr = ", ".join(constraints)
                parts.append(f'<span class="avail-chip partial"><span class="dot" style="background:{color}"></span>{WORKER_NAMES[wid]}: off {cstr}</span>')
            else:
                parts.append(f'<span class="avail-chip on"><span class="dot" style="background:{color}"></span>{WORKER_NAMES[wid]}</span>')
        parts.append('</div>')

        # Gantt chart
        day_start = 600   # 10:00
        day_end = 1320     # 22:00
        total_mins = day_end - day_start

        parts.append('<div class="gantt-wrap">')

        # Demand shading
        for c in info["covs"]:
            lp = ((c["start_minutes"] - day_start) / total_mins) * 100
            wp = ((c["end_minutes"] - c["start_minutes"]) / total_mins) * 100
            mw = c["min_workers"]
            parts.append(
                f'<div class="gantt-demand" style="left:{lp:.2f}%;width:{wp:.2f}%">'
                f'<span class="demand-label">need {mw}</span></div>'
            )

        # Worker bars
        sorted_assigns = sorted(info["assigns"],
                                key=lambda a: (a["start_minutes"], WORKER_ORDER.index(a["worker_id"]) if a["worker_id"] in WORKER_ORDER else 99))
        for lane, a in enumerate(sorted_assigns):
            lp = ((a["start_minutes"] - day_start) / total_mins) * 100
            wp = ((a["end_minutes"] - a["start_minutes"]) / total_mins) * 100
            color = WORKER_COLORS.get(a["worker_id"], "#888")
            dur = (a["end_minutes"] - a["start_minutes"]) / 60
            parts.append(
                f'<div class="gantt-bar" style="left:{lp:.2f}%;width:{wp:.2f}%;'
                f'background:{color}18;border-left:3px solid {color};top:{lane * 36 + 28}px">'
                f'<span class="bar-name" style="color:{color}">{a["worker_name"]}</span>'
                f'<span class="bar-time">{mins_to_time(a["start_minutes"])}–{mins_to_time(a["end_minutes"])}</span>'
                f'<span class="bar-dur">{dur:.1f}h</span>'
                f'</div>'
            )

        # Gap bars
        for gi, g in enumerate(info["gaps"]):
            lp = ((g["start_minutes"] - day_start) / total_mins) * 100
            wp = ((g["end_minutes"] - g["start_minutes"]) / total_mins) * 100
            top = (len(sorted_assigns) + gi) * 36 + 28
            parts.append(
                f'<div class="gantt-gap" style="left:{lp:.2f}%;width:{wp:.2f}%;top:{top}px">'
                f'GAP {mins_to_time(g["start_minutes"])}–{mins_to_time(g["end_minutes"])}: '
                f'need {g["required"]}, have {g["assigned"]}</div>'
            )

        chart_h = (len(sorted_assigns) + len(info["gaps"])) * 36 + 36
        parts.append(f'<div style="height:{max(chart_h, 64)}px"></div>')

        # Time axis
        parts.append('<div class="gantt-axis">')
        for hour in range(10, 23):
            lp = ((hour * 60 - day_start) / total_mins) * 100
            parts.append(f'<span class="tick" style="left:{lp:.2f}%">{hour:02d}:00</span>')
        parts.append('</div>')
        parts.append('</div>')  # gantt-wrap
        parts.append('</div>')  # day-detail

    parts.append('</body></html>')
    return '\n'.join(parts)


HTML_HEAD = """<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>March 2026 — Monthly Schedule</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;color:#1a1a1a;line-height:1.5}
.report-header{padding:36px 48px 20px;border-bottom:1px solid #e5e5e5}
.report-header h1{font-size:26px;font-weight:700}
.sub{color:#888;font-size:13px;margin-top:4px}
.section{padding:28px 48px}
.section h2{font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#333;
  margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid #eee}

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

/* Worker summary */
.worker-summary{max-width:560px}
.ws-row{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.ws-name{width:100px;font-size:13px;font-weight:600;white-space:nowrap}
.ws-hours{width:50px;text-align:right;font-size:13px;font-weight:700}
.ws-bar{flex:1;height:16px;background:#f5f5f5;border-radius:3px;overflow:hidden}
.ws-fill{height:100%;border-radius:3px}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:middle}

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
.gantt-wrap{position:relative;background:#fafafa;border:1px solid #e5e5e5;border-radius:8px;
  overflow:hidden;padding:0}
.gantt-demand{position:absolute;top:0;background:#eff6ff;border-left:2px dashed #93c5fd;
  border-right:2px dashed #93c5fd;display:flex;align-items:flex-start;justify-content:center;
  padding-top:4px;z-index:0;height:24px}
.demand-label{font-size:10px;color:#60a5fa;font-weight:600}
.gantt-bar{position:absolute;height:30px;border-radius:5px;display:flex;align-items:center;
  gap:6px;padding:0 8px;font-size:12px;white-space:nowrap;overflow:hidden;z-index:1}
.bar-name{font-weight:700;font-size:12px}
.bar-time{color:#666;font-size:11px}
.bar-dur{color:#888;font-size:11px;background:#f0f0f0;padding:1px 4px;border-radius:3px}
.gantt-gap{position:absolute;height:30px;border-radius:5px;display:flex;align-items:center;
  padding:0 8px;font-size:11px;background:#fef2f2;border:1px dashed #fca5a5;color:#dc2626;
  white-space:nowrap;z-index:1}
.gantt-axis{display:flex;position:relative;height:24px;border-top:1px solid #e5e5e5;background:#fafafa}
.tick{position:absolute;font-size:10px;color:#aaa;transform:translateX(-50%);top:4px;font-weight:500}
@media print{.day-detail{break-inside:avoid}}
</style>
</head><body>
"""


def main():
    try:
        resp = requests.get(f"{SOLVER_URL}/health", timeout=5)
        print(f"Solver: {resp.json()}")
    except requests.ConnectionError:
        print(f"Solver not running at {SOLVER_URL}")
        print("  Start it: cd solver && python main.py")
        return

    scenario = build_scenario()
    print(f"Scenario: {NUM_DAYS} days, {len(scenario['workers'])} workers, "
          f"{len(scenario['coverage_windows'])} coverage windows, "
          f"{len(scenario['unavailability'])} unavailability entries")
    print("Solving (timeout 120s) ...", flush=True)

    resp = requests.post(f"{SOLVER_URL}/solve", json=scenario, timeout=180)
    if resp.status_code != 200:
        print(f"Solver error {resp.status_code}: {resp.text[:300]}")
        return

    result = resp.json()
    print(f"  {result['status']} · {len(result['assignments'])} shifts · "
          f"{len(result['coverage_gaps'])} gaps · {result['solve_time_ms']}ms")

    html = build_html(scenario, result)
    out = Path(__file__).parent / "march_report.html"
    out.write_text(html, encoding="utf-8")
    print(f"\nReport saved → {out}")
    webbrowser.open(f"file://{out.resolve()}")


if __name__ == "__main__":
    main()
