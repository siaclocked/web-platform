"""
Ziedonis Cafe — Two-Week Scenario (2026-05-11 → 2026-05-24)

Second scheduling window for Ziedonis Cafe. Major changes vs the first run:

  * New bartender **Madara Garance** joins → Bar team of 3.
  * Monday is now an **open day** (previously closed).
  * Opening hours changed:
        Mon–Thu   13:00 → 23:00   (10 h open)
        Fri–Sun   11:00 → 23:00   (12 h open)
  * Every worker is flagged `can_open = can_close = True`.
  * Thu–Sun waiter coverage is now a **handoff** pair:
        quiet opener closes at 21:00,
        peak closer joins at 18:00 and stays till close.
  * Diāna is on **vacation Thu 14 → Sun 17** (week 1), full-day unavail.

See README.md in this folder for interpretation of the availability grid.
"""

from datetime import date, timedelta

# ── Horizon ──────────────────────────────────────────────────────────────────

START = date(2026, 5, 11)   # Monday
NUM_DAYS = 14               # 2026-05-11 … 2026-05-24 inclusive
PLACE_ID = "ziedonis"

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

# Cafe is open every weekday in this horizon.
CLOSED_WEEKDAYS: set[int] = set()


def weekday(d: int) -> int:
    return (START + timedelta(days=d)).weekday()


def day_date(d: int) -> date:
    return START + timedelta(days=d)


# ── Skills ───────────────────────────────────────────────────────────────────

SKILL_BAR = "Bar"
SKILL_WAITER = "Waiter"


# ── Workers ──────────────────────────────────────────────────────────────────

WORKER_ORDER = [
    "robijs", "diana", "madara",
    "dana", "estere", "marta",
]

WORKER_NAMES = {
    "robijs": "Robijs",
    "diana":  "Diāna",
    "madara": "Madara Garance",
    "dana":   "Dana",
    "estere": "Estere",
    "marta":  "Marta Strautniece",
}

WORKER_COLORS = {
    "robijs": "#2563eb",
    "diana":  "#0891b2",
    "madara": "#db2777",
    "dana":   "#16a34a",
    "estere": "#d97706",
    "marta":  "#7c3aed",
}

WORKER_ROLE_LABEL = {
    "robijs": "Head Bartender",
    "diana":  "Bartender",
    "madara": "Bartender",
    "dana":   "Waitress",
    "estere": "Waitress",
    "marta":  "Waitress",
}

SKILL_RATINGS = {
    "robijs": {SKILL_BAR: 10},
    "diana":  {SKILL_BAR: 10},
    "madara": {SKILL_BAR: 8},
    "dana":   {SKILL_WAITER: 8},
    "estere": {SKILL_WAITER: 8},
    "marta":  {SKILL_WAITER: 9},
}

# Client: "Everyone is able to open and close the cash register."
WORKER_FLAGS = {
    "robijs": (True, True),
    "diana":  (True, True),
    "madara": (True, True),
    "dana":   (True, True),
    "estere": (True, True),
    "marta":  (True, True),
}

# Uniform full-time target across the crew (40 h min / 55 h optimal).
CONTRACTS = {
    "robijs": ("Full-time", 40, 55),
    "diana":  ("Full-time", 40, 55),
    "madara": ("Full-time", 40, 55),
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


# ── Coverage ─────────────────────────────────────────────────────────────────
#
# Mon–Thu  open 13:00 → close 23:00   (10 h)
# Fri–Sun  open 11:00 → close 23:00   (12 h)
# Peak     18:00 → 21:00 (client-confirmed)
#
# Thu–Sun waiter coverage is a **handoff** pair: the opener leaves at 21:00,
# the closer joins at 18:00 and stays until close. Overlap 18:00–21:00 = 2
# waiters on the floor. Mon–Wed keeps a single full-day waiter (no peak).

# Bar defaults to a single full-day window. On Thu 14 and Fri 15 only —
# while Diāna is on vacation — we split bar into a Madara-opener / Robijs-
# closer handoff so the solver gets boundaries at 18:00 & 21:00 and accepts
# the 2-bartender overlap during 18:00–21:00. Every other day keeps the
# single-bartender full-day shape (even Thu 21 and Fri 22 in week 2).
BAR_HANDOFF_DAYS = {3, 4}      # Thu 14, Fri 15

# Waiter coverage unchanged by handoff rule:
#   Mon–Wed   : one full-day waiter (no peak)
#   Thu       : quiet opener 13–21, peak closer 18–23
#   Fri–Sun   : quiet opener 11–21, peak closer 18–23


def _day_open_minutes(wd: int) -> int:
    return 11 * 60 if wd >= 4 else 13 * 60


def _bar_windows_for_day(d: int) -> list[tuple[int, int]]:
    """Return [(start, end), ...] for the bar coverage on day d."""
    wd = weekday(d)
    open_m = _day_open_minutes(wd)
    close_m = 23 * 60
    if d in BAR_HANDOFF_DAYS:
        # Opener: open → 21:00.  Closer: 18:00 → 23:00.
        return [(open_m, 21 * 60), (18 * 60, close_m)]
    return [(open_m, close_m)]


def _waiter_windows_for_day(d: int) -> list[tuple[int, int]]:
    wd = weekday(d)
    open_m = _day_open_minutes(wd)
    close_m = 23 * 60
    if wd in (0, 1, 2):
        # Mon–Wed: business-wise a single waiter across the day, but we split
        # the coverage at 18:00 into two back-to-back (NON-overlapping)
        # windows. This only adds a boundary point — it does NOT demand a
        # second worker — and lets the solver hand off between two workers
        # when nobody has full-day availability (e.g. Mon 11 where Estere is
        # free 13–18 and Dana 18–23).
        return [(open_m, 18 * 60), (18 * 60, close_m)]
    # Thu–Sun: quiet opener (open → 21) + peak closer (18 → close). The
    # 18–21 overlap is genuine — sum of min_workers=2 across that span.
    return [(open_m, 21 * 60), (18 * 60, close_m)]


def _build_coverage():
    """Every window capped min=max=1. Where two windows of the same skill
    overlap (e.g. bar opener + bar closer 18–21 on Thu 14, or waiter quiet +
    peak 18–21 on Thu–Sun) the sums form an effective 2-worker cap/demand
    across the overlap. That's exactly the handoff pattern we want."""
    windows = []
    cid = 0
    for d in range(NUM_DAYS):
        if weekday(d) in CLOSED_WEEKDAYS:
            continue
        for (start, end) in _bar_windows_for_day(d):
            windows.append({
                "id": f"cov-{cid}", "skill_id": SKILL_BAR, "day": d,
                "start_minutes": start, "end_minutes": end,
                "min_workers": 1, "max_workers": 1,
            })
            cid += 1
        for (start, end) in _waiter_windows_for_day(d):
            windows.append({
                "id": f"cov-{cid}", "skill_id": SKILL_WAITER, "day": d,
                "start_minutes": start, "end_minutes": end,
                "min_workers": 1, "max_workers": 1,
            })
            cid += 1
    return windows


# ── Unavailability ───────────────────────────────────────────────────────────
#
# Day offset reference:
#   d=0  Mon 11.05    d=7   Mon 18.05
#   d=1  Tue 12.05    d=8   Tue 19.05
#   d=2  Wed 13.05    d=9   Wed 20.05
#   d=3  Thu 14.05    d=10  Thu 21.05
#   d=4  Fri 15.05    d=11  Fri 22.05
#   d=5  Sat 16.05    d=12  Sat 23.05
#   d=6  Sun 17.05    d=13  Sun 24.05
#
# Convention: `_time_range(w, d, start_h, end_h)` blocks the worker during
# [start_h, end_h] on day d. When the staff-app grid reads "available only
# 17:00-23:00", we translate that to TWO complementary blocking ranges
# (before-start and after-end) so every hour outside the window is blocked.

def _full_day(worker_id, d):
    return {"worker_id": worker_id, "day": d, "is_full_day": True}


def _time_range(worker_id, d, start_h, end_h):
    return {
        "worker_id": worker_id, "day": d,
        "start_minutes": int(start_h * 60),
        "end_minutes": int(end_h * 60),
        "is_full_day": False,
    }


def _available_only(worker_id, d, start_h, end_h):
    """Worker available only inside [start_h, end_h] → emit complementary
    unavailability ranges so every hour outside the window is blocked."""
    entries = []
    if start_h > 0:
        entries.append(_time_range(worker_id, d, 0, start_h))
    if end_h < 24:
        entries.append(_time_range(worker_id, d, end_h, 24))
    return entries


def _build_unavailability():
    ua: list[dict] = []

    # ── Bar ──────────────────────────────────────────────────────────────────
    # Diāna: vacation Thu 14.05 → Sun 17.05 (red hearts in the app).
    for d in (3, 4, 5, 6):
        ua.append(_full_day("diana", d))

    # Madara: full days off per the ✕ cells in the screenshot.
    for d in (1, 5, 6, 11, 12):
        ua.append(_full_day("madara", d))

    # Robijs: no availability markers in the screenshot → fully available.

    # ── Waiter ───────────────────────────────────────────────────────────────
    # Dana:
    #   Mon 11.05  available only 17:00–23:00
    #   Thu 14.05  full day off
    #   Fri 15.05  full day off
    #   Fri 22.05  full day off
    #   Sat 23.05  full day off
    ua.extend(_available_only("dana", 0, 17, 23))
    for d in (3, 4, 11, 12):
        ua.append(_full_day("dana", d))

    # Estere:
    #   Mon 11.05  available only 09:00–18:00
    #   Wed 13.05  full day off
    #   Wed 20.05  available only 09:00–14:00  (13:00–14:00 overlap → 1h < min)
    #   Fri 22.05  available only 09:00–14:30  (11:00–14:30 overlap → 3.5h OK)
    ua.extend(_available_only("estere", 0, 9, 18))
    ua.append(_full_day("estere", 2))
    ua.extend(_available_only("estere", 9, 9, 14))
    ua.extend(_available_only("estere", 11, 9, 14.5))

    # Marta:
    #   Mon 11.05  available 11:00–15:00   (13:00–15:00 overlap → 2h < min)
    #   Tue 12.05  available 11:00–15:00   (13:00–15:00 → 2h < min)
    #   Wed 13.05  available 11:00–17:00   (13:00–17:00 → 4h OK)
    #   Thu 14.05  full day off
    #   Sun 17.05  available 11:00–15:00   (11:00–15:00 → 4h OK)
    #   Mon 18.05  available 11:00–15:00   (13:00–15:00 → 2h < min)
    #   Tue 19.05  available 11:00–17:00   (13:00–17:00 → 4h OK)
    #   Wed 20.05  available 11:00–19:00   (13:00–19:00 → 6h OK)
    #   Sat 23.05  full day off
    ua.extend(_available_only("marta", 0, 11, 15))
    ua.extend(_available_only("marta", 1, 11, 15))
    ua.extend(_available_only("marta", 2, 11, 17))
    ua.append(_full_day("marta", 3))
    ua.extend(_available_only("marta", 6, 11, 15))
    ua.extend(_available_only("marta", 7, 11, 15))
    ua.extend(_available_only("marta", 8, 11, 17))
    ua.extend(_available_only("marta", 9, 11, 19))
    ua.append(_full_day("marta", 12))

    return ua


# ── Skill constraints ────────────────────────────────────────────────────────

SKILL_CONSTRAINTS: list[dict] = []


# ── Pinned (locked) shifts ───────────────────────────────────────────────────
#
# Client instructions for this round:
#   • Diāna locks Mon/Tue/Wed (before her vacation): full bar 13–23.
#   • Madara opens Thu 14 and Fri 15; Robijs joins at peak and closes.
#         Thu 14  Madara 13:00–21:00,  Robijs 18:00–23:00
#         Fri 15  Madara 11:00–21:00,  Robijs 18:00–23:00
#   • Robijs covers the full bar on Sat 16 + Sun 17 (Madara off, Diāna on
#     vacation → he is the only eligible bartender). Full 11:00–23:00 shift.
#   • Madara takes the quieter start of week 2: Mon 18 + Tue 19 full bar.
#   • Everything else (Wed 20, Thu 21, Fri 22, Sat 23, Sun 24 bar, and all
#     waiter shifts) is left to the solver.

def _pin(worker_id, skill_id, d, start_h, end_h):
    return {
        "worker_id": worker_id,
        "skill_id": skill_id,
        "day": d,
        "start_minutes": int(start_h * 60),
        "end_minutes": int(end_h * 60),
        "is_locked": True,
    }


def _build_existing_assignments():
    return [
        # Diāna — Mon/Tue/Wed before vacation
        _pin("diana", SKILL_BAR, 0, 13, 23),
        _pin("diana", SKILL_BAR, 1, 13, 23),
        _pin("diana", SKILL_BAR, 2, 13, 23),
        # Thu 14 handoff: Madara opens, Robijs closes
        _pin("madara", SKILL_BAR, 3, 13, 21),
        _pin("robijs", SKILL_BAR, 3, 18, 23),
        # Fri 15 handoff: Madara opens, Robijs closes
        _pin("madara", SKILL_BAR, 4, 11, 21),
        _pin("robijs", SKILL_BAR, 4, 18, 23),
        # Sat 16 + Sun 17: only Robijs available for bar
        _pin("robijs", SKILL_BAR, 5, 11, 23),
        _pin("robijs", SKILL_BAR, 6, 11, 23),
        # Week 2 quieter start: Madara
        _pin("madara", SKILL_BAR, 7, 13, 23),
        _pin("madara", SKILL_BAR, 8, 13, 23),
    ]


# ── Settings ─────────────────────────────────────────────────────────────────
#
# Max shift bumped to 12 h so a single bartender can cover Sat/Sun 11:00–23:00
# (Robijs during Diāna's vacation week). Soft-max stays at 9 h so the solver
# still prefers shorter shifts when it has a choice.

SETTINGS = {
    "max_hours_per_day": 12,
    "min_shift_minutes": 180,        # 3 h hard minimum
    "max_shift_minutes": 720,        # 12 h hard maximum
    "soft_min_shift_minutes": 240,   # 4 h preferred minimum
    "soft_max_shift_minutes": 540,   # 9 h preferred maximum
    "min_rest_between_shifts": 10,
    "granularity_minutes": 30,
}


# ── Build full request ───────────────────────────────────────────────────────

def build_scenario() -> dict:
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
        "minimize_changes": True,
        "solver_timeout_seconds": 60,
    }
