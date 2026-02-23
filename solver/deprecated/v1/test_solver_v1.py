"""
Comprehensive Solver Test Suite
Tests the /solve and /validate endpoints against requirements.

Run: python test_solver.py
Requires: solver running on http://localhost:8000
"""

import requests
import json
import sys
from datetime import datetime, timedelta

SOLVER_URL = "http://localhost:8000"

# ─── Pretty Printing Helpers ───────────────────────────────────────────────────

COLORS = {
    "reset": "\033[0m",
    "bold": "\033[1m",
    "dim": "\033[2m",
    "red": "\033[91m",
    "green": "\033[92m",
    "yellow": "\033[93m",
    "blue": "\033[94m",
    "magenta": "\033[95m",
    "cyan": "\033[96m",
}

def c(text, color):
    return f"{COLORS.get(color, '')}{text}{COLORS['reset']}"

def mins_to_time(minutes):
    h, m = divmod(minutes, 60)
    return f"{h:02d}:{m:02d}"

def day_name(day_num):
    return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day_num % 7]

def print_header(title):
    width = 80
    print("\n" + c("=" * width, "cyan"))
    print(c(f"  {title}", "bold"))
    print(c("=" * width, "cyan"))

def print_section(title):
    print(f"\n  {c('▸ ' + title, 'yellow')}")
    print(f"  {c('─' * 60, 'dim')}")

def print_input(request_data):
    """Pretty-print the solver input data."""
    print_section("INPUT DATA")

    # Schedule info
    print(f"    Place: {c(request_data['place_id'], 'blue')}")
    print(f"    Period: {c(request_data['start_date'], 'blue')} → {c(request_data['end_date'], 'blue')}")

    # Workers
    workers = request_data.get("workers", [])
    print(f"\n    {c('Workers', 'magenta')} ({len(workers)}):")
    for w in workers:
        skills = ", ".join(w["skill_ids"])
        ratings = ", ".join(f"{k}={v}" for k, v in w.get("skill_ratings", {}).items())
        print(f"      • {c(w['name'], 'bold')} (id: {w['id'][:8]}…)")
        print(f"        Skills: [{skills}]  Ratings: [{ratings}]")

    # Coverage windows
    covs = request_data.get("coverage_windows", [])
    print(f"\n    {c('Coverage Windows', 'magenta')} ({len(covs)}):")
    for cov in covs:
        print(f"      • {day_name(cov['day'])} {mins_to_time(cov['start_minutes'])}–{mins_to_time(cov['end_minutes'])}  "
              f"skill={cov['skill_id']}  min_workers={cov['min_workers']}")

    # Unavailability
    unavails = request_data.get("unavailability", [])
    if unavails:
        print(f"\n    {c('Unavailability', 'magenta')} ({len(unavails)}):")
        for ua in unavails:
            if ua.get("is_full_day"):
                print(f"      • Worker {ua['worker_id'][:8]}… — {day_name(ua['day'])} FULL DAY")
            else:
                print(f"      • Worker {ua['worker_id'][:8]}… — {day_name(ua['day'])} "
                      f"{mins_to_time(ua.get('start_minutes',0))}–{mins_to_time(ua.get('end_minutes',0))}")

    # Existing assignments
    existing = request_data.get("existing_assignments", [])
    if existing:
        print(f"\n    {c('Existing Assignments', 'magenta')} ({len(existing)}):")
        for ea in existing:
            lock = " 🔒 LOCKED" if ea.get("is_locked") else ""
            print(f"      • Worker {ea['worker_id'][:8]}… — {day_name(ea['day'])} "
                  f"{mins_to_time(ea['start_minutes'])}–{mins_to_time(ea['end_minutes'])} "
                  f"skill={ea['skill_id']}{lock}")

    # Settings
    settings = request_data.get("settings", {})
    if settings:
        print(f"\n    {c('Settings', 'magenta')}:")
        print(f"      max_hours/day={settings.get('max_hours_per_day', 12)}  "
              f"block={settings.get('min_hours_per_block', 2)}–{settings.get('max_hours_per_block', 10)}h  "
              f"rest={settings.get('min_rest_between_shifts', 8)}h  "
              f"granularity={settings.get('granularity_minutes', 15)}min")


def print_solve_output(response_data):
    """Pretty-print the solver output data."""
    print_section("OUTPUT DATA")

    status = response_data.get("status", "UNKNOWN")
    status_color = "green" if status == "OPTIMAL" else ("yellow" if status == "FEASIBLE" else "red")
    print(f"    Status: {c(status, status_color)}")
    print(f"    Solve time: {response_data.get('solve_time_ms', '?')}ms")

    # Assignments
    assignments = response_data.get("assignments", [])
    print(f"\n    {c('Assignments', 'magenta')} ({len(assignments)}):")
    if assignments:
        # Group by day
        by_day = {}
        for a in assignments:
            by_day.setdefault(a["day"], []).append(a)
        for day in sorted(by_day.keys()):
            print(f"      {c(f'Day {day} ({day_name(day)}):', 'bold')}")
            for a in sorted(by_day[day], key=lambda x: x["start_minutes"]):
                print(f"        {mins_to_time(a['start_minutes'])}–{mins_to_time(a['end_minutes'])}  "
                      f"{c(a['worker_name'], 'cyan')}  skill={a['skill_id']}")
    else:
        print(f"      {c('(none)', 'dim')}")

    # Coverage gaps
    gaps = response_data.get("coverage_gaps", [])
    if gaps:
        print(f"\n    {c('Coverage Gaps', 'red')} ({len(gaps)}):")
        for g in gaps:
            print(f"      ⚠ {day_name(g['day'])} {mins_to_time(g['start_minutes'])}–{mins_to_time(g['end_minutes'])}  "
                  f"skill={g['skill_id']}  needed={g['required']} got={g['assigned']}")
    else:
        print(f"\n    {c('Coverage Gaps: None ✓', 'green')}")

    # Hours by worker
    hours = response_data.get("total_hours_by_worker", {})
    if hours:
        print(f"\n    {c('Hours by Worker', 'magenta')}:")
        for wid, h in hours.items():
            bar = "█" * int(h * 2)
            print(f"      {wid[:8]}…  {h:5.1f}h  {c(bar, 'blue')}")

    # Diagnostics
    diags = response_data.get("diagnostics", [])
    if diags:
        print(f"\n    {c('Diagnostics', 'magenta')}:")
        for d in diags:
            print(f"      ℹ {d}")


def print_validate_output(response_data):
    """Pretty-print the validate output."""
    print_section("VALIDATION RESULT")
    valid = response_data.get("valid", False)
    if valid:
        print(f"    {c('✓ VALID — No constraint violations', 'green')}")
    else:
        print(f"    {c('✗ INVALID', 'red')}")
        for v in response_data.get("violations", []):
            print(f"      ⚠ {v}")


# ─── API Callers ───────────────────────────────────────────────────────────────

def call_solve(request_data, label):
    print_header(f"TEST: {label}  [POST /solve]")
    print_input(request_data)
    try:
        resp = requests.post(f"{SOLVER_URL}/solve", json=request_data, timeout=60)
        if resp.status_code == 200:
            data = resp.json()
            print_solve_output(data)
            return data
        else:
            print(f"\n    {c(f'HTTP {resp.status_code}: {resp.text}', 'red')}")
            return None
    except requests.ConnectionError:
        print(f"\n    {c('ERROR: Cannot connect to solver at ' + SOLVER_URL, 'red')}")
        sys.exit(1)


def call_validate(request_data, label):
    print_header(f"TEST: {label}  [POST /validate]")
    print_input(request_data)
    try:
        resp = requests.post(f"{SOLVER_URL}/validate", json=request_data, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            print_validate_output(data)
            return data
        else:
            print(f"\n    {c(f'HTTP {resp.status_code}: {resp.text}', 'red')}")
            return None
    except requests.ConnectionError:
        print(f"\n    {c('ERROR: Cannot connect to solver at ' + SOLVER_URL, 'red')}")
        sys.exit(1)


# ─── Test Data Builders ────────────────────────────────────────────────────────

# Use next Monday as start_date for consistency
def next_monday():
    today = datetime.now().date()
    days_ahead = (7 - today.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    return today + timedelta(days=days_ahead)

START = next_monday().isoformat()
END = (next_monday() + timedelta(days=6)).isoformat()  # Full week Mon-Sun


def make_worker(id, name, skill_ids, ratings=None):
    return {
        "id": id,
        "name": name,
        "skill_ids": skill_ids,
        "place_ids": ["place-1"],
        "skill_ratings": ratings or {s: 5 for s in skill_ids},
    }


def make_coverage(id, skill_id, day, start_h, end_h, min_workers=1):
    return {
        "id": id,
        "skill_id": skill_id,
        "day": day,
        "start_minutes": start_h * 60,
        "end_minutes": end_h * 60,
        "min_workers": min_workers,
    }


# ─── Test Definitions ─────────────────────────────────────────────────────────

def test_1_simple_one_worker_one_shift():
    """Simplest case: 1 worker, 1 shift, 1 day. Should always be OPTIMAL."""
    return {
        "place_id": "place-1",
        "start_date": START,
        "end_date": START,  # single day
        "workers": [
            make_worker("w1", "Alice", ["waiter"]),
        ],
        "coverage_windows": [
            make_coverage("cov-1", "waiter", next_monday().weekday(), 9, 17),
        ],
        "settings": {"max_hours_per_day": 12, "min_hours_per_block": 2, "max_hours_per_block": 10,
                      "min_rest_between_shifts": 8, "granularity_minutes": 15},
    }


def test_2_two_workers_balanced():
    """2 workers, 2 shifts (Mon morning + Mon afternoon). Should balance evenly."""
    day = next_monday().weekday()
    return {
        "place_id": "place-1",
        "start_date": START,
        "end_date": START,
        "workers": [
            make_worker("w1", "Alice", ["waiter"]),
            make_worker("w2", "Bob", ["waiter"]),
        ],
        "coverage_windows": [
            make_coverage("cov-am", "waiter", day, 8, 14),
            make_coverage("cov-pm", "waiter", day, 14, 22),
        ],
        "balance_hours": True,
        "settings": {"max_hours_per_day": 12, "min_hours_per_block": 2, "max_hours_per_block": 10,
                      "min_rest_between_shifts": 8, "granularity_minutes": 15},
    }


def test_3_unavailability_full_day():
    """Worker A unavailable on Monday. Worker B must cover it."""
    day = next_monday().weekday()
    return {
        "place_id": "place-1",
        "start_date": START,
        "end_date": START,
        "workers": [
            make_worker("w1", "Alice", ["waiter"]),
            make_worker("w2", "Bob", ["waiter"]),
        ],
        "coverage_windows": [
            make_coverage("cov-1", "waiter", day, 9, 17),
        ],
        "unavailability": [
            {"worker_id": "w1", "day": day, "is_full_day": True},
        ],
        "settings": {"max_hours_per_day": 12, "min_hours_per_block": 2, "max_hours_per_block": 10,
                      "min_rest_between_shifts": 8, "granularity_minutes": 15},
    }


def test_4_unavailability_time_range():
    """Worker A unavailable 9-13. Should only be assigned to the PM shift."""
    day = next_monday().weekday()
    return {
        "place_id": "place-1",
        "start_date": START,
        "end_date": START,
        "workers": [
            make_worker("w1", "Alice", ["waiter"]),
            make_worker("w2", "Bob", ["waiter"]),
        ],
        "coverage_windows": [
            make_coverage("cov-am", "waiter", day, 9, 13),
            make_coverage("cov-pm", "waiter", day, 14, 20),
        ],
        "unavailability": [
            {"worker_id": "w1", "day": day, "start_minutes": 9*60, "end_minutes": 13*60, "is_full_day": False},
        ],
        "balance_hours": True,
        "settings": {"max_hours_per_day": 12, "min_hours_per_block": 2, "max_hours_per_block": 10,
                      "min_rest_between_shifts": 8, "granularity_minutes": 15},
    }


def test_5_skill_constraint():
    """Two skills needed. Workers have different skills. Each must fill their matching shift."""
    day = next_monday().weekday()
    return {
        "place_id": "place-1",
        "start_date": START,
        "end_date": START,
        "workers": [
            make_worker("w1", "Alice the Cook", ["cook"]),
            make_worker("w2", "Bob the Waiter", ["waiter"]),
        ],
        "coverage_windows": [
            make_coverage("cov-cook", "cook", day, 10, 18),
            make_coverage("cov-waiter", "waiter", day, 10, 18),
        ],
        "settings": {"max_hours_per_day": 12, "min_hours_per_block": 2, "max_hours_per_block": 10,
                      "min_rest_between_shifts": 8, "granularity_minutes": 15},
    }


def test_6_infeasible_not_enough_workers():
    """Need 3 workers but only have 2. Should report coverage gaps."""
    day = next_monday().weekday()
    return {
        "place_id": "place-1",
        "start_date": START,
        "end_date": START,
        "workers": [
            make_worker("w1", "Alice", ["waiter"]),
            make_worker("w2", "Bob", ["waiter"]),
        ],
        "coverage_windows": [
            make_coverage("cov-1", "waiter", day, 9, 17, min_workers=3),
        ],
        "settings": {"max_hours_per_day": 12, "min_hours_per_block": 2, "max_hours_per_block": 10,
                      "min_rest_between_shifts": 8, "granularity_minutes": 15},
    }


def test_7_multi_day_week():
    """Full week, 3 workers, 1 shift/day Mon-Fri. Tests balancing over a week."""
    mon = next_monday().weekday()
    return {
        "place_id": "place-1",
        "start_date": START,
        "end_date": (next_monday() + timedelta(days=4)).isoformat(),  # Mon-Fri
        "workers": [
            make_worker("w1", "Alice", ["waiter"]),
            make_worker("w2", "Bob", ["waiter"]),
            make_worker("w3", "Carol", ["waiter"]),
        ],
        "coverage_windows": [
            make_coverage(f"cov-d{d}", "waiter", (mon + d) % 7, 9, 17)
            for d in range(5)
        ],
        "balance_hours": True,
        "settings": {"max_hours_per_day": 12, "min_hours_per_block": 2, "max_hours_per_block": 10,
                      "min_rest_between_shifts": 8, "granularity_minutes": 15},
    }


def test_8_locked_assignment():
    """Worker A is locked to Monday shift. Solver must keep that assignment."""
    day = next_monday().weekday()
    return {
        "place_id": "place-1",
        "start_date": START,
        "end_date": START,
        "workers": [
            make_worker("w1", "Alice", ["waiter"]),
            make_worker("w2", "Bob", ["waiter"]),
        ],
        "coverage_windows": [
            make_coverage("cov-1", "waiter", day, 9, 17),
        ],
        "existing_assignments": [
            {"worker_id": "w1", "skill_id": "waiter", "day": day,
             "start_minutes": 9*60, "end_minutes": 17*60, "is_locked": True},
        ],
        "minimize_changes": True,
        "settings": {"max_hours_per_day": 12, "min_hours_per_block": 2, "max_hours_per_block": 10,
                      "min_rest_between_shifts": 8, "granularity_minutes": 15},
    }


def test_9_minimize_changes():
    """Existing schedule has Alice on Mon, Bob on Tue. Solver should preserve it."""
    mon = next_monday().weekday()
    tue = (mon + 1) % 7
    end_date = (next_monday() + timedelta(days=1)).isoformat()
    return {
        "place_id": "place-1",
        "start_date": START,
        "end_date": end_date,
        "workers": [
            make_worker("w1", "Alice", ["waiter"]),
            make_worker("w2", "Bob", ["waiter"]),
        ],
        "coverage_windows": [
            make_coverage("cov-mon", "waiter", mon, 9, 17),
            make_coverage("cov-tue", "waiter", tue, 9, 17),
        ],
        "existing_assignments": [
            {"worker_id": "w1", "skill_id": "waiter", "day": mon,
             "start_minutes": 9*60, "end_minutes": 17*60, "is_locked": False},
            {"worker_id": "w2", "skill_id": "waiter", "day": tue,
             "start_minutes": 9*60, "end_minutes": 17*60, "is_locked": False},
        ],
        "minimize_changes": True,
        "balance_hours": True,
        "settings": {"max_hours_per_day": 12, "min_hours_per_block": 2, "max_hours_per_block": 10,
                      "min_rest_between_shifts": 8, "granularity_minutes": 15},
    }


def test_10_multiple_skills_same_worker():
    """Worker has multiple skills. Need both filled. Worker can only do 1/day."""
    day = next_monday().weekday()
    return {
        "place_id": "place-1",
        "start_date": START,
        "end_date": START,
        "workers": [
            make_worker("w1", "Alice", ["cook", "waiter"], {"cook": 8, "waiter": 5}),
            make_worker("w2", "Bob", ["waiter"], {"waiter": 7}),
        ],
        "coverage_windows": [
            make_coverage("cov-cook", "cook", day, 10, 18),
            make_coverage("cov-waiter", "waiter", day, 10, 18),
        ],
        "settings": {"max_hours_per_day": 12, "min_hours_per_block": 2, "max_hours_per_block": 10,
                      "min_rest_between_shifts": 8, "granularity_minutes": 15},
    }


def test_11_no_workers_at_all():
    """Edge case: coverage needed but zero workers."""
    day = next_monday().weekday()
    return {
        "place_id": "place-1",
        "start_date": START,
        "end_date": START,
        "workers": [],
        "coverage_windows": [
            make_coverage("cov-1", "waiter", day, 9, 17),
        ],
        "settings": {"max_hours_per_day": 12, "min_hours_per_block": 2, "max_hours_per_block": 10,
                      "min_rest_between_shifts": 8, "granularity_minutes": 15},
    }


def test_12_all_workers_unavailable():
    """All workers unavailable. Should result in coverage gaps."""
    day = next_monday().weekday()
    return {
        "place_id": "place-1",
        "start_date": START,
        "end_date": START,
        "workers": [
            make_worker("w1", "Alice", ["waiter"]),
            make_worker("w2", "Bob", ["waiter"]),
        ],
        "coverage_windows": [
            make_coverage("cov-1", "waiter", day, 9, 17),
        ],
        "unavailability": [
            {"worker_id": "w1", "day": day, "is_full_day": True},
            {"worker_id": "w2", "day": day, "is_full_day": True},
        ],
        "settings": {"max_hours_per_day": 12, "min_hours_per_block": 2, "max_hours_per_block": 10,
                      "min_rest_between_shifts": 8, "granularity_minutes": 15},
    }


def test_13_large_team_balancing():
    """6 workers, 3 shifts/day over 5 days. Tests load balancing at scale."""
    mon = next_monday().weekday()
    workers = [make_worker(f"w{i}", name, ["waiter"])
               for i, name in enumerate(["Alice", "Bob", "Carol", "Dave", "Eve", "Frank"])]
    covs = []
    for d in range(5):
        dow = (mon + d) % 7
        covs.append(make_coverage(f"cov-d{d}-am", "waiter", dow, 7, 12, min_workers=1))
        covs.append(make_coverage(f"cov-d{d}-mid", "waiter", dow, 12, 17, min_workers=1))
        covs.append(make_coverage(f"cov-d{d}-pm", "waiter", dow, 17, 23, min_workers=1))
    return {
        "place_id": "place-1",
        "start_date": START,
        "end_date": (next_monday() + timedelta(days=4)).isoformat(),
        "workers": workers,
        "coverage_windows": covs,
        "balance_hours": True,
        "settings": {"max_hours_per_day": 12, "min_hours_per_block": 2, "max_hours_per_block": 10,
                      "min_rest_between_shifts": 8, "granularity_minutes": 15},
    }


# ─── Validation Tests ─────────────────────────────────────────────────────────

def test_validate_valid_schedule():
    """Existing assignment respects all constraints. Should be valid."""
    day = next_monday().weekday()
    return {
        "place_id": "place-1",
        "start_date": START,
        "end_date": START,
        "workers": [make_worker("w1", "Alice", ["waiter"])],
        "coverage_windows": [make_coverage("cov-1", "waiter", day, 9, 17)],
        "existing_assignments": [
            {"worker_id": "w1", "skill_id": "waiter", "day": day,
             "start_minutes": 9*60, "end_minutes": 17*60, "is_locked": False},
        ],
        "settings": {"max_hours_per_day": 12, "min_hours_per_block": 2, "max_hours_per_block": 10,
                      "min_rest_between_shifts": 8, "granularity_minutes": 15},
    }


def test_validate_wrong_skill():
    """Worker assigned a skill they don't have. Should be invalid."""
    day = next_monday().weekday()
    return {
        "place_id": "place-1",
        "start_date": START,
        "end_date": START,
        "workers": [make_worker("w1", "Alice", ["cook"])],  # only cook
        "coverage_windows": [make_coverage("cov-1", "waiter", day, 9, 17)],
        "existing_assignments": [
            {"worker_id": "w1", "skill_id": "waiter", "day": day,  # assigned waiter!
             "start_minutes": 9*60, "end_minutes": 17*60, "is_locked": False},
        ],
        "settings": {"max_hours_per_day": 12, "min_hours_per_block": 2, "max_hours_per_block": 10,
                      "min_rest_between_shifts": 8, "granularity_minutes": 15},
    }


def test_validate_unavailable_conflict():
    """Worker assigned during their unavailable day. Should be invalid."""
    day = next_monday().weekday()
    return {
        "place_id": "place-1",
        "start_date": START,
        "end_date": START,
        "workers": [make_worker("w1", "Alice", ["waiter"])],
        "coverage_windows": [make_coverage("cov-1", "waiter", day, 9, 17)],
        "existing_assignments": [
            {"worker_id": "w1", "skill_id": "waiter", "day": day,
             "start_minutes": 9*60, "end_minutes": 17*60, "is_locked": False},
        ],
        "unavailability": [
            {"worker_id": "w1", "day": day, "is_full_day": True},
        ],
        "settings": {"max_hours_per_day": 12, "min_hours_per_block": 2, "max_hours_per_block": 10,
                      "min_rest_between_shifts": 8, "granularity_minutes": 15},
    }


def test_validate_time_range_conflict():
    """Worker assigned during their unavailable time range. Should be invalid."""
    day = next_monday().weekday()
    return {
        "place_id": "place-1",
        "start_date": START,
        "end_date": START,
        "workers": [make_worker("w1", "Alice", ["waiter"])],
        "coverage_windows": [make_coverage("cov-1", "waiter", day, 9, 17)],
        "existing_assignments": [
            {"worker_id": "w1", "skill_id": "waiter", "day": day,
             "start_minutes": 9*60, "end_minutes": 17*60, "is_locked": False},
        ],
        "unavailability": [
            {"worker_id": "w1", "day": day, "start_minutes": 10*60, "end_minutes": 14*60, "is_full_day": False},
        ],
        "settings": {"max_hours_per_day": 12, "min_hours_per_block": 2, "max_hours_per_block": 10,
                      "min_rest_between_shifts": 8, "granularity_minutes": 15},
    }


# ─── Assertions ────────────────────────────────────────────────────────────────

passed = 0
failed = 0

def assert_test(condition, test_name, detail=""):
    global passed, failed
    if condition:
        print(f"\n    {c('✓ PASS', 'green')}: {test_name}")
        passed += 1
    else:
        print(f"\n    {c('✗ FAIL', 'red')}: {test_name}  {detail}")
        failed += 1


# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    global passed, failed

    # Check health first
    print_header("HEALTH CHECK")
    try:
        resp = requests.get(f"{SOLVER_URL}/health", timeout=5)
        print(f"  {c('✓ Solver is running', 'green')} — {resp.json()}")
    except requests.ConnectionError:
        print(f"  {c('✗ Solver is NOT running at ' + SOLVER_URL, 'red')}")
        print(f"  Start it with: cd solver && python main.py")
        sys.exit(1)

    # ── SOLVE tests ──

    # Test 1
    result = call_solve(test_1_simple_one_worker_one_shift(), "1 — Simple: 1 worker, 1 shift")
    assert_test(result and result["status"] == "OPTIMAL", "Status is OPTIMAL")
    assert_test(result and len(result["assignments"]) == 1, "Exactly 1 assignment")
    assert_test(result and result["assignments"][0]["worker_name"] == "Alice", "Alice assigned")

    # Test 2
    result = call_solve(test_2_two_workers_balanced(), "2 — Two workers, balanced AM/PM")
    assert_test(result and result["status"] in ("OPTIMAL", "FEASIBLE"), "Status is OPTIMAL or FEASIBLE")
    assert_test(result and len(result["assignments"]) == 2, "Exactly 2 assignments")
    if result:
        names = {a["worker_name"] for a in result["assignments"]}
        assert_test(names == {"Alice", "Bob"}, "Both workers assigned", f"got {names}")

    # Test 3
    result = call_solve(test_3_unavailability_full_day(), "3 — Full-day unavailability")
    assert_test(result and result["status"] in ("OPTIMAL", "FEASIBLE"), "Solvable")
    if result:
        assigned = [a["worker_name"] for a in result["assignments"]]
        assert_test("Alice" not in assigned, "Alice NOT assigned (unavailable)", f"got {assigned}")
        assert_test("Bob" in assigned, "Bob IS assigned", f"got {assigned}")

    # Test 4
    result = call_solve(test_4_unavailability_time_range(), "4 — Time-range unavailability")
    assert_test(result and result["status"] in ("OPTIMAL", "FEASIBLE"), "Solvable")
    if result:
        alice_shifts = [a for a in result["assignments"] if a["worker_name"] == "Alice"]
        for a in alice_shifts:
            assert_test(a["start_minutes"] >= 13*60, "Alice only assigned after 13:00",
                       f"got {mins_to_time(a['start_minutes'])}")

    # Test 5
    result = call_solve(test_5_skill_constraint(), "5 — Different skills per worker")
    assert_test(result and result["status"] in ("OPTIMAL", "FEASIBLE"), "Solvable")
    if result:
        for a in result["assignments"]:
            if a["worker_name"] == "Alice the Cook":
                assert_test(a["skill_id"] == "cook", "Alice assigned cook", f"got {a['skill_id']}")
            if a["worker_name"] == "Bob the Waiter":
                assert_test(a["skill_id"] == "waiter", "Bob assigned waiter", f"got {a['skill_id']}")

    # Test 6
    result = call_solve(test_6_infeasible_not_enough_workers(), "6 — Not enough workers (need 3, have 2)")
    assert_test(result and len(result["coverage_gaps"]) > 0, "Has coverage gaps")
    if result and result["coverage_gaps"]:
        gap = result["coverage_gaps"][0]
        assert_test(gap["required"] == 3 and gap["assigned"] == 2, "Gap: needed 3, got 2",
                   f"needed={gap['required']} got={gap['assigned']}")

    # Test 7
    result = call_solve(test_7_multi_day_week(), "7 — Full week, 3 workers, balanced")
    assert_test(result and result["status"] in ("OPTIMAL", "FEASIBLE"), "Solvable")
    if result:
        hours = result["total_hours_by_worker"]
        vals = list(hours.values())
        spread = max(vals) - min(vals) if vals else 999
        assert_test(spread <= 16, f"Hour spread ≤ 16h", f"spread={spread:.1f}h")

    # Test 8
    result = call_solve(test_8_locked_assignment(), "8 — Locked assignment preserved")
    assert_test(result and result["status"] in ("OPTIMAL", "FEASIBLE"), "Solvable")
    if result:
        alice_assigned = any(a["worker_name"] == "Alice" for a in result["assignments"])
        assert_test(alice_assigned, "Alice's locked assignment preserved")

    # Test 9
    result = call_solve(test_9_minimize_changes(), "9 — Minimize changes from existing")
    assert_test(result and result["status"] in ("OPTIMAL", "FEASIBLE"), "Solvable")
    if result:
        mon_worker = next((a["worker_name"] for a in result["assignments"] if a["day"] == 0), None)
        tue_worker = next((a["worker_name"] for a in result["assignments"] if a["day"] == 1), None)
        assert_test(mon_worker == "Alice", "Alice still on Mon", f"got {mon_worker}")
        assert_test(tue_worker == "Bob", "Bob still on Tue", f"got {tue_worker}")

    # Test 10
    result = call_solve(test_10_multiple_skills_same_worker(), "10 — Multi-skill worker (max 1 shift/day)")
    assert_test(result and result["status"] in ("OPTIMAL", "FEASIBLE"), "Solvable")
    if result:
        alice_shifts = [a for a in result["assignments"] if a["worker_name"] == "Alice"]
        assert_test(len(alice_shifts) <= 1, "Alice has ≤1 shift (max one per day)", f"got {len(alice_shifts)}")

    # Test 11
    result = call_solve(test_11_no_workers_at_all(), "11 — Edge: No workers at all")
    assert_test(result is not None, "Doesn't crash")
    if result:
        assert_test(len(result["assignments"]) == 0, "No assignments")
        assert_test(len(result["coverage_gaps"]) > 0, "Coverage gap reported")

    # Test 12
    result = call_solve(test_12_all_workers_unavailable(), "12 — All workers unavailable")
    assert_test(result is not None, "Doesn't crash")
    if result:
        assert_test(len(result["assignments"]) == 0, "No assignments possible")
        assert_test(len(result["coverage_gaps"]) > 0, "Coverage gap reported")

    # Test 13
    result = call_solve(test_13_large_team_balancing(), "13 — Large team: 6 workers, 15 shifts, 5 days")
    assert_test(result and result["status"] in ("OPTIMAL", "FEASIBLE"), "Solvable")
    if result:
        hours = result["total_hours_by_worker"]
        vals = [v for v in hours.values() if v > 0]
        if vals:
            spread = max(vals) - min(vals)
            assert_test(spread <= 12, f"Hour spread ≤ 12h among active workers", f"spread={spread:.1f}h")

    # ── VALIDATE tests ──

    result = call_validate(test_validate_valid_schedule(), "V1 — Valid schedule")
    assert_test(result and result["valid"] == True, "Schedule is valid")

    result = call_validate(test_validate_wrong_skill(), "V2 — Wrong skill assigned")
    assert_test(result and result["valid"] == False, "Schedule is invalid")
    if result:
        assert_test(any("skill" in v.lower() for v in result.get("violations", [])),
                   "Violation mentions skill", f"violations={result.get('violations')}")

    result = call_validate(test_validate_unavailable_conflict(), "V3 — Full-day unavailability conflict")
    assert_test(result and result["valid"] == False, "Schedule is invalid")
    if result:
        assert_test(len(result.get("violations", [])) > 0, "Has violations")

    result = call_validate(test_validate_time_range_conflict(), "V4 — Time-range unavailability conflict")
    assert_test(result and result["valid"] == False, "Schedule is invalid")
    if result:
        assert_test(len(result.get("violations", [])) > 0, "Has violations")

    # ── Summary ──
    print_header("TEST SUMMARY")
    total = passed + failed
    print(f"  {c(f'{passed}/{total} passed', 'green' if failed == 0 else 'yellow')}")
    if failed:
        print(f"  {c(f'{failed} FAILED', 'red')}")
    else:
        print(f"  {c('All tests passed! ✓', 'green')}")
    print()

    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
