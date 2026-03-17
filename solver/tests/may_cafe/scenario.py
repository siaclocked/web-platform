"""
Clocked Cafe — May 2026 Full-Month Scenario

A realistic café with 12 workers across two skills (Floor & Bar),
monthly hour contracts, vacations, recurring unavailability, and
a public holiday. Primary goal: validate monthly min/max hour targets
alongside all other solver constraints.

Case data provided by the QA team.
"""

from datetime import date, timedelta

START = date(2026, 5, 1)   # Friday
NUM_DAYS = 31
PLACE_ID = "clocked-cafe"

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

PUBLIC_HOLIDAYS = {3}  # May 4 (day offset 3, a Monday) — treated as Sunday coverage


def weekday(d: int) -> int:
    """Return weekday index (Mon=0 … Sun=6) for day offset d."""
    return (START + timedelta(days=d)).weekday()


def day_date(d: int) -> date:
    return START + timedelta(days=d)


# ── Workers ──────────────────────────────────────────────────────────────────

WORKER_ORDER = [
    # Floor
    "anna", "mark", "sofia", "lukas", "emma", "david", "mia", "toms",
    # Bar
    "julia", "erik", "laura", "kevin",
]

WORKER_NAMES = {
    "anna": "Anna", "mark": "Mark", "sofia": "Sofia", "lukas": "Lukas",
    "emma": "Emma", "david": "David", "mia": "Mia", "toms": "Toms",
    "julia": "Julia", "erik": "Erik", "laura": "Laura", "kevin": "Kevin",
}

WORKER_COLORS = {
    "anna":   "#2563eb",  "mark":   "#dc2626",  "sofia":  "#16a34a",
    "lukas":  "#d97706",  "emma":   "#7c3aed",  "david":  "#db2777",
    "mia":    "#0d9488",  "toms":   "#ea580c",
    "julia":  "#0891b2",  "erik":   "#4f46e5",  "laura":  "#65a30d",
    "kevin":  "#be123c",
}

# Contract info for the report  {id: (contract_label, monthly_min, monthly_optimal)}
CONTRACTS = {
    "anna":   ("Full-Time", 140, 168),
    "mark":   ("Full-Time", 140, 168),
    "sofia":  ("120 h",     100, 120),
    "lukas":  ("100 h",      85, 100),
    "emma":   ("80 h",       65,  80),
    "david":  ("80 h",       65,  80),
    "mia":    ("60 h",       50,  60),
    "toms":   ("60 h",       50,  60),
    "julia":  ("Full-Time", 140, 168),
    "erik":   ("120 h",     100, 120),
    "laura":  ("60 h",       50,  60),
    "kevin":  ("60 h",       50,  60),
}

# Skill ratings — Senior: 8, Mid: 6, Junior: 4
SKILL_RATINGS = {
    "anna":  {"Floor": 8},
    "mark":  {"Floor": 8},
    "sofia": {"Floor": 6},
    "lukas": {"Floor": 6},
    "emma":  {"Floor": 6},
    "david": {"Floor": 4},
    "mia":   {"Floor": 4},
    "toms":  {"Floor": 4},
    "julia": {"Bar": 8},
    "erik":  {"Bar": 8},
    "laura": {"Bar": 6},
    "kevin": {"Bar": 6},
}

# can_open / can_close per worker
# can_close: based on "can close register/bar" notes
# can_open: Seniors & Mids can open; Juniors cannot
WORKER_FLAGS = {
    #              can_open  can_close
    "anna":       (True,     True),
    "mark":       (True,     True),
    "sofia":      (True,     True),
    "lukas":      (True,     False),
    "emma":       (True,     True),
    "david":      (False,    True),
    "mia":        (False,    False),
    "toms":       (False,    True),
    "julia":      (True,     True),
    "erik":       (True,     True),
    "laura":      (True,     True),
    "kevin":      (True,     False),
}


def _build_workers():
    workers = []
    for wid in WORKER_ORDER:
        skills = list(SKILL_RATINGS[wid].keys())
        contract_label, monthly_min, monthly_optimal = CONTRACTS[wid]
        can_open, can_close = WORKER_FLAGS[wid]
        workers.append({
            "id": wid,
            "name": WORKER_NAMES[wid],
            "skill_ids": skills,
            "place_ids": [PLACE_ID],
            "skill_ratings": SKILL_RATINGS[wid],
            "can_open": can_open,
            "can_close": can_close,
            "monthly_min_hours": monthly_min,
            "monthly_optimal_hours": monthly_optimal,
        })
    return workers


# ── Coverage Windows ─────────────────────────────────────────────────────────

# Coverage patterns by day type: list of (start_h, end_h, floor_min, bar_min)
COVERAGE_MON_THU = [
    ( 8, 11, 2, 1),
    (11, 14, 4, 2),
    (14, 17, 3, 2),
    (17, 20, 3, 2),
]

COVERAGE_FRIDAY = [
    ( 8, 11, 2, 1),
    (11, 14, 4, 2),
    (14, 17, 3, 2),
    (17, 22, 4, 2),
]

COVERAGE_SATURDAY = [
    ( 9, 12, 2, 2),
    (12, 16, 3, 2),
    (16, 22, 4, 2),
]

COVERAGE_SUNDAY = [
    ( 9, 12, 2, 1),
    (12, 16, 3, 2),
    (16, 18, 2, 1),
]


def _coverage_pattern(d: int):
    """Return the coverage pattern for day offset d."""
    if d in PUBLIC_HOLIDAYS:
        return COVERAGE_SUNDAY  # public holidays use Sunday staffing
    wd = weekday(d)
    if wd <= 3:       # Mon–Thu
        return COVERAGE_MON_THU
    elif wd == 4:     # Fri
        return COVERAGE_FRIDAY
    elif wd == 5:     # Sat
        return COVERAGE_SATURDAY
    else:             # Sun
        return COVERAGE_SUNDAY


def _build_coverage():
    windows = []
    cid = 0
    for d in range(NUM_DAYS):
        pattern = _coverage_pattern(d)
        for start_h, end_h, floor_min, bar_min in pattern:
            if floor_min > 0:
                windows.append({
                    "id": f"cov-{cid}",
                    "skill_id": "Floor",
                    "day": d,
                    "start_minutes": start_h * 60,
                    "end_minutes": end_h * 60,
                    "min_workers": floor_min,
                })
                cid += 1
            if bar_min > 0:
                windows.append({
                    "id": f"cov-{cid}",
                    "skill_id": "Bar",
                    "day": d,
                    "start_minutes": start_h * 60,
                    "end_minutes": end_h * 60,
                    "min_workers": bar_min,
                })
                cid += 1
    return windows


# ── Unavailability ───────────────────────────────────────────────────────────

def _full_day(worker_id, d):
    return {"worker_id": worker_id, "day": d, "is_full_day": True}


def _time_range(worker_id, d, start_h, end_h):
    return {
        "worker_id": worker_id, "day": d,
        "start_minutes": int(start_h * 60), "end_minutes": int(end_h * 60),
        "is_full_day": False,
    }


def _build_unavailability():
    ua = []

    # ── Vacations ──
    # Anna: May 6–10  → d=5..9
    for d in range(5, 10):
        ua.append(_full_day("anna", d))
    # Laura: May 20–24 → d=19..23
    for d in range(19, 24):
        ua.append(_full_day("laura", d))
    # Lukas: May 27–31 → d=26..30
    for d in range(26, 31):
        ua.append(_full_day("lukas", d))

    # ── Recurring constraints ──
    for d in range(NUM_DAYS):
        wd = weekday(d)

        # Sofia: No Mondays (university)
        if wd == 0:
            ua.append(_full_day("sofia", d))

        # Mia: Only Sat–Sun (off all weekdays)
        if wd not in (5, 6):
            ua.append(_full_day("mia", d))

        # Toms: Only after 16:00 (unavailable 00:00–16:00 every day)
        ua.append(_time_range("toms", d, 0, 16))

        # Kevin: No Sundays
        if wd == 6:
            ua.append(_full_day("kevin", d))

    # ── One-off constraints ──
    # Emma: Not available May 3–4 → d=2,3
    ua.append(_full_day("emma", 2))
    ua.append(_full_day("emma", 3))

    return ua


# ── Settings ─────────────────────────────────────────────────────────────────

SETTINGS = {
    "max_hours_per_day": 12,
    "min_shift_minutes": 120,        # 2 h hard minimum
    "max_shift_minutes": 720,        # 12 h hard maximum
    "soft_min_shift_minutes": 240,   # 4 h preferred minimum
    "soft_max_shift_minutes": 480,   # 8 h preferred maximum
    "min_rest_between_shifts": 10,   # 10 h rest between consecutive days
    "granularity_minutes": 30,
}


# ── Build full request ───────────────────────────────────────────────────────

def build_scenario() -> dict:
    """Return the full SolveRequest payload for the Clocked Cafe May 2026 case."""
    return {
        "place_id": PLACE_ID,
        "start_date": START.isoformat(),
        "end_date": (START + timedelta(days=NUM_DAYS - 1)).isoformat(),
        "workers": _build_workers(),
        "coverage_windows": _build_coverage(),
        "unavailability": _build_unavailability(),
        "existing_assignments": [],
        "skill_constraints": [],
        "worker_month_context": [],
        "settings": SETTINGS,
        "balance_hours": True,
        "minimize_changes": False,
        "solver_timeout_seconds": 120,
    }
