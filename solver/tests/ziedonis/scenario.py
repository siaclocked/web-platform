"""
Ziedonis Cafe — Two-Week Scenario (2026-04-27 → 2026-05-10)

Case data sourced from "Ziedonis Employes 24.04.pdf" (the client's filled-in
Café Schedule Builder form) plus a follow-up list of employee unavailability.

See README.md in this folder for the full list of assumptions we made to fill
gaps in the source data (peak-hour boundaries, can_open/can_close flags,
contract targets, etc.).
"""

from datetime import date, timedelta

# ── Horizon ──────────────────────────────────────────────────────────────────

START = date(2026, 4, 27)   # Monday
NUM_DAYS = 14               # 2026-04-27 … 2026-05-10 (inclusive)
PLACE_ID = "ziedonis"

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

# Monday is a closed day every week → no coverage on d=0 (27.04) or d=7 (04.05).
CLOSED_WEEKDAYS = {0}  # Monday


def weekday(d: int) -> int:
    """Return weekday index (Mon=0 … Sun=6) for day offset d."""
    return (START + timedelta(days=d)).weekday()


def day_date(d: int) -> date:
    return START + timedelta(days=d)


# ── Skills ───────────────────────────────────────────────────────────────────

SKILL_BAR = "Bar"
SKILL_WAITER = "Waiter"


# ── Workers ──────────────────────────────────────────────────────────────────
#
# Source: PDF Part 2 (Employees 1-5).
# Contract Type: all Full-time (confirmed in form).
# Can Open / Can Close: the form did not have any option selected for any
# employee → we inferred defaults from role + probation status + skill level.
# See README.md for the full rationale.

WORKER_ORDER = [
    "robijs",   # head bartender
    "diana",    # bartender
    "dana",     # waitress (on probation, needs support)
    "estere",   # waitress (on probation, works well alone)
    "marta",    # waitress
]

WORKER_NAMES = {
    "robijs": "Robijs",
    "diana":  "Diāna",
    "dana":   "Dana",
    "estere": "Estere",
    "marta":  "Marta",
}

# Palette (for the HTML report — unrelated to solver logic).
WORKER_COLORS = {
    "robijs": "#2563eb",
    "diana":  "#0891b2",
    "dana":   "#16a34a",
    "estere": "#d97706",
    "marta":  "#7c3aed",
}

# Role label shown in the report header for context.
WORKER_ROLE_LABEL = {
    "robijs": "Head Bartender",
    "diana":  "Bartender",
    "dana":   "Waitress (probation, needs support)",
    "estere": "Waitress (probation, works alone)",
    "marta":  "Waitress",
}

# Skill ratings taken directly from the PDF skill slider.
SKILL_RATINGS = {
    "robijs": {SKILL_BAR: 10},
    "diana":  {SKILL_BAR: 10},
    "dana":   {SKILL_WAITER: 8},
    "estere": {SKILL_WAITER: 8},
    "marta":  {SKILL_WAITER: 9},
}

# (can_open, can_close) — see README for reasoning.
WORKER_FLAGS = {
    "robijs": (True,  True),
    "diana":  (True,  True),
    "dana":   (False, False),   # on probation + needs support
    "estere": (True,  True),    # probation but works well without supervision
    "marta":  (True,  True),
}

# Contract info for the report  {id: (contract_label, period_min_hours, period_optimal_hours)}
# The PDF confirms everyone is Full-Time and the client wants every full-time
# worker treated the same way regardless of how much availability they actually
# offer in this 2-week window. We therefore use one uniform target across the
# crew. Workers whose unavailability prevents them from hitting these numbers
# (e.g. Estere's uni schedule) will simply fall short — that shows up as a
# soft shortfall rather than skewed targets.
CONTRACTS = {
    "robijs": ("Full-time", 40, 55),
    "diana":  ("Full-time", 40, 55),
    "dana":   ("Full-time", 40, 55),
    "estere": ("Full-time", 40, 55),
    "marta":  ("Full-time", 40, 55),
}


def _build_workers():
    workers = []
    for wid in WORKER_ORDER:
        skills = list(SKILL_RATINGS[wid].keys())
        can_open, can_close = WORKER_FLAGS[wid]
        _, period_min, period_opt = CONTRACTS[wid]
        workers.append({
            "id": wid,
            "name": WORKER_NAMES[wid],
            "skill_ids": skills,
            "place_ids": [PLACE_ID],
            "skill_ratings": SKILL_RATINGS[wid],
            "can_open": can_open,
            "can_close": can_close,
            "monthly_min_hours": period_min,
            "monthly_optimal_hours": period_opt,
        })
    return workers


# ── Opening hours (from PDF Part 1) ──────────────────────────────────────────
# Monday: Closed
# Tuesday–Thursday: 15:00–22:00
# Friday: 15:00–23:00
# Saturday: 13:00–22:00
# Sunday: 13:00–22:00
#
# Head bartender must arrive by 14:30 on weekdays (30 min prep before open).
# Waiter / Bartender arrive at open time (15:00 weekday / 13:00 weekend).
# We encode Bar coverage starting at 14:30 on weekdays so the solver schedules
# a bartender for the prep half-hour. Either Robijs (head) or Diana may fill
# it — the solver does not distinguish "head" bartender and, with only two
# bartenders on staff, one of them has to work the whole shift anyway.

# (start_min, end_min, bar_min, waiter_quiet_min, waiter_peak_min)
# Peak layer = EXTRA waiter on top of quiet baseline during busy evening hours.
# Quiet (2 total) = 1 Bar + 1 Waiter.  Peak (3 total) = 1 Bar + 2 Waiter.

# Peak = 18:00–21:00 every open day (per client confirmation).

# Tue–Wed (open 15:00–22:00, 7h) — quieter weeknights, NO peak waiter.
# Per client (24.04.2026): "tuesdays and wednesdays in peak hours we don't
# need the extra worker so it stays 2 [people total] the whole day".
COVERAGE_TUE_WED = {
    "bar":           (14 * 60 + 30, 22 * 60),   # 14:30–22:00 (pre-open prep included)
    "waiter_quiet":  (15 * 60,      22 * 60),   # 15:00–22:00
    # waiter_peak intentionally omitted
}

# Thu (open 15:00–22:00, 7h) — peak rush still applies.
COVERAGE_THU = {
    "bar":           (14 * 60 + 30, 22 * 60),
    "waiter_quiet":  (15 * 60,      22 * 60),
    "waiter_peak":   (18 * 60,      21 * 60),
}

# Fri (open 15:00–23:00, 8h)
COVERAGE_FRI = {
    "bar":           (14 * 60 + 30, 23 * 60),   # 14:30–23:00
    "waiter_quiet":  (15 * 60,      23 * 60),   # 15:00–23:00
    "waiter_peak":   (18 * 60,      21 * 60),   # 18:00–21:00
}

# Sat (open 13:00–22:00, 9h)
COVERAGE_SAT = {
    "bar":           (13 * 60, 22 * 60),        # 13:00–22:00
    "waiter_quiet":  (13 * 60, 22 * 60),        # 13:00–22:00
    "waiter_peak":   (18 * 60, 21 * 60),        # 18:00–21:00
}

# Sun (open 13:00–22:00, 9h) — same as Sat
COVERAGE_SUN = dict(COVERAGE_SAT)


def _coverage_for_day(d: int):
    """Return the coverage dict for day offset d, or None if closed."""
    wd = weekday(d)
    if wd in CLOSED_WEEKDAYS:
        return None
    if wd in (1, 2):           # Tue, Wed — no peak waiter
        return COVERAGE_TUE_WED
    if wd == 3:                # Thu — peak waiter applies
        return COVERAGE_THU
    if wd == 4:                # Fri
        return COVERAGE_FRI
    if wd == 5:                # Sat
        return COVERAGE_SAT
    return COVERAGE_SUN        # Sun


def _build_coverage():
    """Every window is capped at exactly `min_workers` headcount (max=min).

    Without caps the solver would happily double-book bartenders or waiters
    to satisfy hour-balance objectives, producing ~48h of overstaffing.
    Stacking semantics: during 18:00–21:00, waiter baseline (cap 1) and
    waiter peak (cap 1) sum to an effective slot cap of 2 workers.
    """
    windows = []
    cid = 0
    for d in range(NUM_DAYS):
        cov = _coverage_for_day(d)
        if cov is None:
            continue

        start, end = cov["bar"]
        windows.append({
            "id": f"cov-{cid}",
            "skill_id": SKILL_BAR,
            "day": d,
            "start_minutes": start,
            "end_minutes": end,
            "min_workers": 1,
            "max_workers": 1,
        })
        cid += 1

        start, end = cov["waiter_quiet"]
        windows.append({
            "id": f"cov-{cid}",
            "skill_id": SKILL_WAITER,
            "day": d,
            "start_minutes": start,
            "end_minutes": end,
            "min_workers": 1,
            "max_workers": 1,
        })
        cid += 1

        if "waiter_peak" in cov:
            start, end = cov["waiter_peak"]
            windows.append({
                "id": f"cov-{cid}",
                "skill_id": SKILL_WAITER,
                "day": d,
                "start_minutes": start,
                "end_minutes": end,
                "min_workers": 1,
                "max_workers": 1,
            })
            cid += 1
    return windows


# ── Unavailability ───────────────────────────────────────────────────────────
#
# Dates from the client message. The horizon starts 27.04.2026 = day 0.
#
# Day offset reference:
#   d=0  Mon 27.04   (CLOSED)     d=7   Mon 04.05  (CLOSED)
#   d=1  Tue 28.04                d=8   Tue 05.05
#   d=2  Wed 29.04                d=9   Wed 06.05
#   d=3  Thu 30.04                d=10  Thu 07.05
#   d=4  Fri 01.05                d=11  Fri 08.05
#   d=5  Sat 02.05                d=12  Sat 09.05
#   d=6  Sun 03.05                d=13  Sun 10.05

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

    # ── Bar ──
    # Robijs: full days off 08.05 (d=11), 09.05 (d=12)
    ua.append(_full_day("robijs", 11))
    ua.append(_full_day("robijs", 12))

    # Diāna: full days off 01.05 (d=4), 03.05 (d=6), 06.05 (d=9)
    # "Gribētu strādāt 2.05" = preference to work 02.05 — not a constraint,
    # documented in README only.
    ua.append(_full_day("diana", 4))
    ua.append(_full_day("diana", 6))
    ua.append(_full_day("diana", 9))

    # ── Waiter ──
    # Dana:
    #   27.04 (16:00-23:00)  → d=0 (Mon closed, retained for fidelity)
    #   03.05 (19:00-23:00)  → d=6
    #   10.05 (19:00-23:00)  → d=13
    ua.append(_time_range("dana", 0, 16, 23))
    ua.append(_time_range("dana", 6, 19, 23))
    ua.append(_time_range("dana", 13, 19, 23))

    # Estere:
    #   27.04 (9:00-17:00)   → d=0 (Mon closed, retained for fidelity)
    #   28.04 full           → d=1
    #   29.04 full           → d=2
    #   30.04 (9:00-19:00)   → d=3 (available 19:00-22:00 only)
    #   05.05 (9:00-14:00)   → d=8 (fully available after open @15:00)
    #   06.05 full           → d=9
    #   08.05 full           → d=11
    #   09.05 full           → d=12
    ua.append(_time_range("estere", 0, 9, 17))
    ua.append(_full_day("estere", 1))
    ua.append(_full_day("estere", 2))
    ua.append(_time_range("estere", 3, 9, 19))
    ua.append(_time_range("estere", 8, 9, 14))
    ua.append(_full_day("estere", 9))
    ua.append(_full_day("estere", 11))
    ua.append(_full_day("estere", 12))

    # Marta:
    #   27.04 (8:00-15:00)   → d=0 (Mon closed)
    #   28.04 (11:00-15:00)  → d=1 (open @15:00, effectively fully available)
    #   29.04 (11:00-15:00)  → d=2
    #   30.04 (11:00-15:00)  → d=3
    #   05.05 (11:00-13:00)  → d=8
    #   06.05 (11:00-15:00)  → d=9
    #   07.05 (11:00-15:00)  → d=10
    #   08.05 full           → d=11
    #   09.05 full           → d=12
    ua.append(_time_range("marta", 0, 8, 15))
    ua.append(_time_range("marta", 1, 11, 15))
    ua.append(_time_range("marta", 2, 11, 15))
    ua.append(_time_range("marta", 3, 11, 15))
    ua.append(_time_range("marta", 8, 11, 13))
    ua.append(_time_range("marta", 9, 11, 15))
    ua.append(_time_range("marta", 10, 11, 15))
    ua.append(_full_day("marta", 11))
    ua.append(_full_day("marta", 12))

    return ua


# ── Skill constraints ────────────────────────────────────────────────────────
# No minimum-team-rating enforcement was requested by the client, so we leave
# this empty. (All workers rate 8+, well above any reasonable threshold.)
SKILL_CONSTRAINTS: list[dict] = []


# ── Pre-assigned / pinned shifts (soft preferences from the client) ─────────
#
# These are LOCKED existing_assignments so the solver must keep them exactly.
# See README §A6.
#
#   • Robijs: client note "Nedēļas pirmajā daļā atleast viena maiņa lai izietu
#     cauri pasūtījumiem" — we pin Robijs to the Bar shift on Tue 28.04 (d=1)
#     and Tue 05.05 (d=8). Tuesday is the first open day of each week.
#
#   • Diāna: client preference "Gribētu strādāt 02.05" — we pin Diana to the
#     Bar shift on Sat 02.05 (d=5).
#
# Each pin covers the entire Bar coverage window on that day (14:30–22:00 on
# weekdays, 13:00–22:00 on weekends), matching our A3 assumption that bar
# coverage starts 30 min pre-open on weekdays for prep.

def _build_existing_assignments():
    return [
        # Robijs — Tuesday early-week (week 1 + week 2)
        {
            "worker_id": "robijs",
            "skill_id": SKILL_BAR,
            "day": 1,               # Tue 28.04
            "start_minutes": 14 * 60 + 30,
            "end_minutes": 22 * 60,
            "is_locked": True,
        },
        {
            "worker_id": "robijs",
            "skill_id": SKILL_BAR,
            "day": 8,               # Tue 05.05
            "start_minutes": 14 * 60 + 30,
            "end_minutes": 22 * 60,
            "is_locked": True,
        },
        # Diāna — wants to work 02.05
        {
            "worker_id": "diana",
            "skill_id": SKILL_BAR,
            "day": 5,               # Sat 02.05
            "start_minutes": 13 * 60,
            "end_minutes": 22 * 60,
            "is_locked": True,
        },
    ]


# ── Settings ─────────────────────────────────────────────────────────────────
#
# Shift length bounds chosen so the solver can:
#   • cover a full Sat/Sun (9h open) with a single shift (max 10h with prep),
#   • cover a full Tue-Thu (7h) with a single shift,
#   • still fall back to a 3h minimum shift to plug partial-availability gaps.
# min_rest_between_shifts of 10h matches the may_cafe scenario.

SETTINGS = {
    "max_hours_per_day": 10,
    "min_shift_minutes": 180,        # 3 h hard minimum
    "max_shift_minutes": 600,        # 10 h hard maximum
    "soft_min_shift_minutes": 240,   # 4 h preferred minimum
    "soft_max_shift_minutes": 540,   # 9 h preferred maximum (matches Sat/Sun open span)
    "min_rest_between_shifts": 10,   # 10 h rest between consecutive days
    "granularity_minutes": 30,
}


# ── Build full request ───────────────────────────────────────────────────────

def build_scenario() -> dict:
    """Return the full SolveRequest payload for the Ziedonis 2-week case."""
    return {
        "place_id": PLACE_ID,
        "start_date": START.isoformat(),
        "end_date": (START + timedelta(days=NUM_DAYS - 1)).isoformat(),
        "workers": _build_workers(),
        "coverage_windows": _build_coverage(),
        "unavailability": _build_unavailability(),
        "existing_assignments": _build_existing_assignments(),
        "skill_constraints": SKILL_CONSTRAINTS,
        "worker_month_context": [],
        "settings": SETTINGS,
        "balance_hours": True,
        "minimize_changes": False,
        "solver_timeout_seconds": 60,
    }
