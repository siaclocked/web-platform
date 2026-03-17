"""
Scenario definitions for solver v2 visual tests.
30 scenarios progressing from trivial to production-scale,
emphasising v2 capabilities: cross-window shifts, partial handoffs,
shift-length preferences, and proportional hour balancing.
"""

from datetime import datetime, timedelta

DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

def day_name(d):
    return DAY_NAMES[d % 7]

def next_monday():
    today = datetime.now().date()
    days_ahead = (7 - today.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    return today + timedelta(days=days_ahead)

START = next_monday().isoformat()

DEFAULT_SETTINGS = {
    "max_hours_per_day": 12,
    "min_hours_per_block": 2,
    "max_hours_per_block": 8,
    "min_rest_between_shifts": 8,
    "granularity_minutes": 30,
}

def w(wid, name, skills, ratings=None):
    return {"id": wid, "name": name, "skill_ids": skills, "place_ids": ["place-1"],
            "skill_ratings": ratings or {s: 5 for s in skills}}

def cov(cid, skill, day, start_h, end_h, min_w=1):
    return {"id": cid, "skill_id": skill, "day": day,
            "start_minutes": int(start_h * 60), "end_minutes": int(end_h * 60), "min_workers": min_w}

def unavail_day(worker_id, day):
    return {"worker_id": worker_id, "day": day, "is_full_day": True}

def unavail_time(worker_id, day, start_h, end_h):
    return {"worker_id": worker_id, "day": day,
            "start_minutes": int(start_h * 60), "end_minutes": int(end_h * 60), "is_full_day": False}

def end_date(extra_days):
    return (next_monday() + timedelta(days=extra_days)).isoformat()


# ═══ GROUP A · FUNDAMENTALS ═══════════════════════════════════════════

def s01():
    return {
        "title": "01 · One Worker, One Shift",
        "description": "Simplest case: Alice covers a single Waiter window 10:00–18:00 Monday. Baseline end-to-end check.",
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [w("w1", "Alice", ["Waiter"], {"Waiter": 8})],
            "coverage_windows": [cov("c1", "Waiter", 0, 10, 18)],
            "settings": DEFAULT_SETTINGS, "balance_hours": False, "minimize_changes": False,
        },
    }

def s02():
    return {
        "title": "02 · Two Workers, Two Windows — Basic Balance",
        "description": "Alice and Bob split AM (08–14) and PM (14–20). Equal windows → equal hours.",
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [w("w1", "Alice", ["Waiter"], {"Waiter": 7}), w("w2", "Bob", ["Waiter"], {"Waiter": 7})],
            "coverage_windows": [cov("am", "Waiter", 0, 8, 14), cov("pm", "Waiter", 0, 14, 20)],
            "settings": DEFAULT_SETTINGS, "balance_hours": True, "minimize_changes": False,
        },
    }

def s03():
    return {
        "title": "03 · Two Roles in Parallel — Cook & Waiter",
        "description": "Alice is a Cook 10–18, Bob is a Waiter 10–18 in parallel on the same day.",
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [w("w1", "Alice", ["Cook"], {"Cook": 9}), w("w2", "Bob", ["Waiter"], {"Waiter": 7})],
            "coverage_windows": [cov("cook", "Cook", 0, 10, 18), cov("wait", "Waiter", 0, 10, 18)],
            "settings": DEFAULT_SETTINGS, "balance_hours": True, "minimize_changes": False,
        },
    }

def s04():
    return {
        "title": "04 · Full-Day Unavailability",
        "description": "Alice (rating 9) is entirely off Monday. Bob (rating 5) must cover 09–17 alone.",
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [w("w1", "Alice", ["Waiter"], {"Waiter": 9}), w("w2", "Bob", ["Waiter"], {"Waiter": 5})],
            "coverage_windows": [cov("c1", "Waiter", 0, 9, 17)],
            "unavailability": [unavail_day("w1", 0)],
            "settings": DEFAULT_SETTINGS, "balance_hours": True, "minimize_changes": False,
        },
    }

def s05():
    return {
        "title": "05 · Morning Unavailability — Forced Handoff",
        "description": "Alice blocked until 13:00. Bob available all day. Bob takes AM, Alice takes PM.",
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [w("w1", "Alice", ["Waiter"], {"Waiter": 8}), w("w2", "Bob", ["Waiter"], {"Waiter": 7})],
            "coverage_windows": [cov("am", "Waiter", 0, 8, 14), cov("pm", "Waiter", 0, 14, 22)],
            "unavailability": [unavail_time("w1", 0, 0, 13)],
            "settings": DEFAULT_SETTINGS, "balance_hours": True, "minimize_changes": False,
        },
    }

def s06():
    return {
        "title": "06 · Understaffed — Coverage Gap Reported",
        "description": "Manager needs 3 waiters 10–18 but only 2 available. Gap of 1 is surfaced clearly.",
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [w("w1", "Alice", ["Waiter"], {"Waiter": 8}), w("w2", "Bob", ["Waiter"], {"Waiter": 7})],
            "coverage_windows": [cov("c1", "Waiter", 0, 10, 18, min_w=3)],
            "settings": DEFAULT_SETTINGS, "balance_hours": True, "minimize_changes": False,
        },
    }


# ═══ GROUP B · V2 CROSS-WINDOW & FLEXIBLE SHIFTS ══════════════════════

def s07():
    return {
        "title": "07 · [V2] Cross-Window — Two Adjacent Windows, One Shift",
        "description": (
            "V2 CORE FEATURE: Two coverage windows (08–13 and 13–16) are staffing requirements, not shift blocks. "
            "Alice is available 08–16. Solver assigns ONE spanning 08–16 shift satisfying both windows — "
            "not two separate 5h + 3h blocks."
        ),
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [w("w1", "Alice", ["Waiter"], {"Waiter": 8})],
            "coverage_windows": [cov("am", "Waiter", 0, 8, 13), cov("pm", "Waiter", 0, 13, 16)],
            "unavailability": [unavail_time("w1", 0, 0, 8), unavail_time("w1", 0, 16, 24)],
            "settings": DEFAULT_SETTINGS, "balance_hours": False, "minimize_changes": False,
        },
    }

def s08():
    return {
        "title": "08 · [V2] Cross-Window — Three Windows, One Spanning Shift",
        "description": (
            "V2 FEATURE: Three windows (08–12, 12–16, 16–20) and Alice available 08–20 with max_hours=8. "
            "Solver finds the best 8h window within the 12h demand range — not three mini-shifts."
        ),
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [w("w1", "Alice", ["Waiter"], {"Waiter": 8})],
            "coverage_windows": [cov("w1", "Waiter", 0, 8, 12), cov("w2", "Waiter", 0, 12, 16), cov("w3", "Waiter", 0, 16, 20)],
            "unavailability": [unavail_time("w1", 0, 0, 8), unavail_time("w1", 0, 20, 24)],
            "settings": {**DEFAULT_SETTINGS, "max_hours_per_block": 8},
            "balance_hours": False, "minimize_changes": False,
        },
    }

def s09():
    return {
        "title": "09 · [V2] Partial Handoff at 13:30",
        "description": (
            "V2 FEATURE: Alice available 09:00–13:30 only, Bob 13:30–16:00 only. "
            "Single coverage window 09:00–16:00 requiring 1 worker. "
            "Solver assigns Alice for the morning portion and Bob for the afternoon — a perfect handoff."
        ),
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [w("w1", "Alice", ["Waiter"], {"Waiter": 8}), w("w2", "Bob", ["Waiter"], {"Waiter": 8})],
            "coverage_windows": [cov("full", "Waiter", 0, 9, 16)],
            "unavailability": [
                unavail_time("w1", 0, 0, 9), unavail_time("w1", 0, 13.5, 24),
                unavail_time("w2", 0, 0, 13.5), unavail_time("w2", 0, 16, 24),
            ],
            "settings": DEFAULT_SETTINGS, "balance_hours": False, "minimize_changes": False,
        },
    }

def s10():
    return {
        "title": "10 · [V2] Uneven Cross-Window — Two Workers Cover Three Windows",
        "description": (
            "V2 FEATURE: Three windows (08–12, 12–17, 17–22). Alice available 08–17, Bob 12–22. "
            "Solver assigns Alice 08–17 (spanning first two windows) and Bob 17–22 (third window) — "
            "not six separate mini-assignments."
        ),
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [w("w1", "Alice", ["Waiter"], {"Waiter": 8}), w("w2", "Bob", ["Waiter"], {"Waiter": 7})],
            "coverage_windows": [
                cov("early", "Waiter", 0, 8, 12), cov("mid", "Waiter", 0, 12, 17), cov("eve", "Waiter", 0, 17, 22),
            ],
            "unavailability": [
                unavail_time("w1", 0, 0, 8), unavail_time("w1", 0, 17, 24),
                unavail_time("w2", 0, 0, 12), unavail_time("w2", 0, 22, 24),
            ],
            "settings": DEFAULT_SETTINGS, "balance_hours": False, "minimize_changes": False,
        },
    }

def s11():
    return {
        "title": "11 · [V2] Parallel Workers + Cross-Window",
        "description": (
            "V2 FEATURE: Two windows (10–14, 14–18) each requiring 2 workers. Four workers all available 08–20. "
            "V2 freely assigns shifts spanning the 10–18 range rather than pinning each to a fixed 4h block."
        ),
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [
                w("w1", "Alice", ["Waiter"], {"Waiter": 9}), w("w2", "Bob", ["Waiter"], {"Waiter": 8}),
                w("w3", "Carol", ["Waiter"], {"Waiter": 7}), w("w4", "Dave", ["Waiter"], {"Waiter": 7}),
            ],
            "coverage_windows": [cov("lunch", "Waiter", 0, 10, 14, min_w=2), cov("dinner", "Waiter", 0, 14, 18, min_w=2)],
            "settings": DEFAULT_SETTINGS, "balance_hours": True, "minimize_changes": False,
        },
    }

def s12():
    return {
        "title": "12 · [V2] Two Roles, Each Spanning Adjacent Windows",
        "description": (
            "V2 FEATURE: Cook windows 09–13 + 13–18, Waiter windows 10–14 + 14–20. "
            "Alice (cook) spans both cook windows in one shift; Bob (waiter) spans both waiter windows. "
            "Two workers, each efficiently covering their role's full demand."
        ),
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [w("w1", "Alice", ["Cook"], {"Cook": 9}), w("w2", "Bob", ["Waiter"], {"Waiter": 8})],
            "coverage_windows": [
                cov("cook-am", "Cook", 0, 9, 13), cov("cook-pm", "Cook", 0, 13, 18),
                cov("wait-am", "Waiter", 0, 10, 14), cov("wait-pm", "Waiter", 0, 14, 20),
            ],
            "settings": DEFAULT_SETTINGS, "balance_hours": False, "minimize_changes": False,
        },
    }

def s13():
    return {
        "title": "13 · Overlapping Skills — Best Fit Assignment",
        "description": (
            "Alice: Cook(9)/Waiter(4), Bob: Waiter(7)/Bartender(8), Carol: Cook(6)/Bartender(5), Dave: Waiter(8). "
            "Solver assigns workers to the role where they have the highest rating."
        ),
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [
                w("w1", "Alice", ["Cook", "Waiter"], {"Cook": 9, "Waiter": 4}),
                w("w2", "Bob",   ["Waiter", "Bartender"], {"Waiter": 7, "Bartender": 8}),
                w("w3", "Carol", ["Cook", "Bartender"], {"Cook": 6, "Bartender": 5}),
                w("w4", "Dave",  ["Waiter"], {"Waiter": 8}),
            ],
            "coverage_windows": [
                cov("cook", "Cook", 0, 10, 18), cov("wait", "Waiter", 0, 10, 18), cov("bar", "Bartender", 0, 16, 23),
            ],
            "settings": DEFAULT_SETTINGS, "balance_hours": True, "minimize_changes": False,
        },
    }

def s14():
    return {
        "title": "14 · Lunch Rush — 2 Parallel Waiters + Cook + Bartender",
        "description": (
            "Lunch peak needs 2 waiters 11–15. Plus Cook 10–18 and Bartender 16–22. "
            "Four workers, each with a clearly defined role. Stacked waiter lanes visible in the Gantt chart."
        ),
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [
                w("w1", "Alice", ["Cook"],       {"Cook": 9}),
                w("w2", "Bob",   ["Waiter"],      {"Waiter": 8}),
                w("w3", "Carol", ["Waiter"],      {"Waiter": 7}),
                w("w4", "Dave",  ["Bartender"],   {"Bartender": 8}),
            ],
            "coverage_windows": [
                cov("cook", "Cook", 0, 10, 18), cov("rush", "Waiter", 0, 11, 15, min_w=2), cov("bar", "Bartender", 0, 16, 22),
            ],
            "settings": DEFAULT_SETTINGS, "balance_hours": True, "minimize_changes": False,
        },
    }

def s15():
    return {
        "title": "15 · Locked Assignment Preserved",
        "description": (
            "Alice is locked as Cook Mon 10–18. On Tuesday she's only available 14–22. "
            "Bob and Carol fill remaining gaps. Solver must pin Alice's locked shift exactly."
        ),
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": end_date(1),
            "workers": [
                w("w1", "Alice", ["Cook", "Waiter"], {"Cook": 9, "Waiter": 6}),
                w("w2", "Bob",   ["Cook", "Waiter"], {"Cook": 7, "Waiter": 8}),
                w("w3", "Carol", ["Waiter"],          {"Waiter": 7}),
            ],
            "coverage_windows": [
                cov("cook-mon", "Cook",   0, 10, 18), cov("wait-mon", "Waiter", 0, 10, 18),
                cov("cook-tue", "Cook",   1, 10, 18), cov("wait-tue", "Waiter", 1, 10, 18),
            ],
            "existing_assignments": [
                {"worker_id": "w1", "skill_id": "Cook", "day": 0,
                 "start_minutes": 600, "end_minutes": 1080, "is_locked": True},
            ],
            "unavailability": [unavail_time("w1", 1, 0, 14), unavail_time("w2", 0, 0, 12), unavail_time("w3", 1, 18, 24)],
            "settings": DEFAULT_SETTINGS, "minimize_changes": True, "balance_hours": True,
        },
    }


# ═══ GROUP C · SHIFT LENGTH CONSTRAINTS ═══════════════════════════════

def s16():
    return {
        "title": "16 · [V2] Min-Length Fallback Under Understaffing",
        "description": (
            "V2 FEATURE: Coverage 12:00–18:00, only Alice available 16:00–18:00 (exactly min_hours=2h). "
            "Solver must assign the 2h minimum shift — partial coverage beats a total gap."
        ),
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [w("w1", "Alice", ["Waiter"], {"Waiter": 8})],
            "coverage_windows": [cov("c1", "Waiter", 0, 12, 18)],
            "unavailability": [unavail_time("w1", 0, 0, 16), unavail_time("w1", 0, 18, 24)],
            "settings": {**DEFAULT_SETTINGS, "min_hours_per_block": 2},
            "balance_hours": False, "minimize_changes": False,
        },
    }

def s17():
    return {
        "title": "17 · [V2] Long-Shift Preference — Avoid Fragmentation",
        "description": (
            "V2 FEATURE: Alice available 08:00–18:00 (10h), max_hours=8h, one coverage window 08–18. "
            "Solver assigns one ~8h shift near the maximum — not a series of minimum-length fragments. "
            "Demonstrates P3 objective: penalise shortfall from max_hours."
        ),
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [w("w1", "Alice", ["Waiter"], {"Waiter": 8})],
            "coverage_windows": [cov("c1", "Waiter", 0, 8, 18)],
            "unavailability": [unavail_time("w1", 0, 0, 8), unavail_time("w1", 0, 18, 24)],
            "settings": {**DEFAULT_SETTINGS, "min_hours_per_block": 2, "max_hours_per_block": 8},
            "balance_hours": False, "minimize_changes": False,
        },
    }

def s18():
    return {
        "title": "18 · [V2] Max-Shift Cap Forces Two Workers",
        "description": (
            "V2 FEATURE: Coverage window 08:00–20:00 (12h) but max_hours=6. "
            "One worker cannot cover it alone. Solver assigns two 6h shifts (e.g. 08–14 + 14–20)."
        ),
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [w("w1", "Alice", ["Waiter"], {"Waiter": 8}), w("w2", "Bob", ["Waiter"], {"Waiter": 7})],
            "coverage_windows": [cov("c1", "Waiter", 0, 8, 20)],
            "settings": {**DEFAULT_SETTINGS, "max_hours_per_block": 6},
            "balance_hours": True, "minimize_changes": False,
        },
    }


# ═══ GROUP D · PROPORTIONAL HOUR BALANCING ════════════════════════════

def s19():
    return {
        "title": "19 · [V2] Proportional Balance — Unequal Availability",
        "description": (
            "V2 FEATURE: Alice available Mon–Fri (5 days), Bob only Mon–Tue (2 days). "
            "Solver distributes hours proportionally — Alice gets ~2.5× more than Bob."
        ),
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": end_date(4),
            "workers": [w("w1", "Alice", ["Waiter"], {"Waiter": 7}), w("w2", "Bob", ["Waiter"], {"Waiter": 7})],
            "coverage_windows": [cov(f"c{d}", "Waiter", d, 9, 17) for d in range(5)],
            "unavailability": [unavail_day("w2", d) for d in range(2, 5)],
            "settings": DEFAULT_SETTINGS, "balance_hours": True, "minimize_changes": False,
        },
    }

def s20():
    return {
        "title": "20 · Equal Balance — 4 Identical Workers, Full Week",
        "description": "Four waiters, identical availability, Mon–Fri, 2 workers per day. Hours should be evenly distributed.",
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": end_date(4),
            "workers": [w(f"w{i}", n, ["Waiter"], {"Waiter": 7}) for i, n in enumerate(["Alice","Bob","Carol","Dave"], 1)],
            "coverage_windows": [cov(f"c{d}", "Waiter", d, 9, 17, min_w=2) for d in range(5)],
            "settings": DEFAULT_SETTINGS, "balance_hours": True, "minimize_changes": False,
        },
    }

def s21():
    return {
        "title": "21 · [V2] Proportional Balance with Partial-Day Availability",
        "description": (
            "V2 FEATURE: Alice mornings only (09–14), Bob afternoons only (14–21), Carol flexible all day Mon–Fri. "
            "Balancing accounts for actual available hours, giving Carol the most shifts."
        ),
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": end_date(4),
            "workers": [
                w("w1", "Alice", ["Waiter"], {"Waiter": 7}),
                w("w2", "Bob",   ["Waiter"], {"Waiter": 7}),
                w("w3", "Carol", ["Waiter"], {"Waiter": 7}),
            ],
            "coverage_windows": (
                [cov(f"am{d}", "Waiter", d,  9, 14) for d in range(5)] +
                [cov(f"pm{d}", "Waiter", d, 14, 21) for d in range(5)]
            ),
            "unavailability": (
                [unavail_time("w1", d, 14, 24) for d in range(5)] +
                [unavail_time("w2", d,  0, 14) for d in range(5)]
            ),
            "settings": DEFAULT_SETTINGS, "balance_hours": True, "minimize_changes": False,
        },
    }


# ═══ GROUP E · MULTI-DAY, MULTI-ROLE ══════════════════════════════════

def s22():
    return {
        "title": "22 · Three Roles, Two Days, Cross-Window per Day",
        "description": (
            "Mon–Tue. Cook, Waiter, Bartender. Adjacent AM+PM windows each day. "
            "V2 assigns single spanning shifts where availability allows."
        ),
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": end_date(1),
            "workers": [
                w("w1", "Alice", ["Cook"],       {"Cook": 9}),
                w("w2", "Bob",   ["Waiter"],      {"Waiter": 8}),
                w("w3", "Carol", ["Waiter"],      {"Waiter": 7}),
                w("w4", "Dave",  ["Bartender"],   {"Bartender": 8}),
            ],
            "coverage_windows": sum(([
                cov(f"cook-am{d}", "Cook",      d, 10, 14),
                cov(f"cook-pm{d}", "Cook",      d, 14, 18),
                cov(f"wait-am{d}", "Waiter",    d, 10, 15),
                cov(f"wait-pm{d}", "Waiter",    d, 15, 21),
                cov(f"bar{d}",     "Bartender", d, 16, 22),
            ] for d in range(2)), []),
            "unavailability": [unavail_time("w3", 0, 0, 15), unavail_time("w3", 1, 15, 24)],
            "settings": DEFAULT_SETTINGS, "balance_hours": True, "minimize_changes": False,
        },
    }

def s23():
    return {
        "title": "23 · Weekend Café — Sat & Sun, 3 Roles",
        "description": (
            "Sat–Sun. Barista, 2× Waiter, Host each day. "
            "Alice off Sunday, Bob only Sat mornings. V2 handles days 0/1 as Sat/Sun offsets."
        ),
        "request": {
            "place_id": "place-1",
            "start_date": (next_monday() + timedelta(days=5)).isoformat(),
            "end_date":   (next_monday() + timedelta(days=6)).isoformat(),
            "workers": [
                w("w1", "Alice", ["Barista", "Waiter"],  {"Barista": 9, "Waiter": 6}),
                w("w2", "Bob",   ["Waiter"],              {"Waiter": 8}),
                w("w3", "Carol", ["Waiter", "Host"],      {"Waiter": 7, "Host": 8}),
                w("w4", "Dave",  ["Barista"],             {"Barista": 7}),
                w("w5", "Eve",   ["Host", "Waiter"],      {"Host": 9, "Waiter": 5}),
            ],
            "coverage_windows": [
                cov("bar-sat",     "Barista", 0, 8, 16),
                cov("wait-sat-am", "Waiter",  0, 8, 14,  min_w=2),
                cov("wait-sat-pm", "Waiter",  0, 14, 20, min_w=2),
                cov("host-sat",    "Host",    0, 10, 18),
                cov("bar-sun",     "Barista", 1, 9, 15),
                cov("wait-sun",    "Waiter",  1, 9, 15,  min_w=2),
                cov("host-sun",    "Host",    1, 9, 15),
            ],
            "unavailability": [unavail_day("w1", 1), unavail_time("w2", 0, 14, 24)],
            "settings": DEFAULT_SETTINGS, "balance_hours": True, "minimize_changes": False,
        },
    }

def s24():
    return {
        "title": "24 · Three-Day Schedule — 5 Workers, Tight Availability",
        "description": (
            "Mon–Wed, 5 workers. Alice mornings only, Bob midday, Carol afternoons, Dave evenings, Eve off Wednesday. "
            "Four roles per day: Cook, Waiter AM, Waiter PM, Bartender."
        ),
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": end_date(2),
            "workers": [
                w("w1", "Alice", ["Waiter", "Host"],       {"Waiter": 7, "Host": 8}),
                w("w2", "Bob",   ["Cook", "Waiter"],        {"Cook": 8, "Waiter": 6}),
                w("w3", "Carol", ["Waiter", "Bartender"],   {"Waiter": 7, "Bartender": 9}),
                w("w4", "Dave",  ["Bartender", "Waiter"],   {"Bartender": 7, "Waiter": 5}),
                w("w5", "Eve",   ["Cook", "Host"],          {"Cook": 9, "Host": 6}),
            ],
            "coverage_windows": sum(([
                cov(f"cook{d}",    "Cook",      d, 10, 18),
                cov(f"wait-am{d}", "Waiter",    d, 10, 16),
                cov(f"wait-pm{d}", "Waiter",    d, 16, 22),
                cov(f"bar{d}",     "Bartender", d, 17, 23),
            ] for d in range(3)), []),
            "unavailability": (
                [unavail_time("w1", d, 14, 24) for d in range(3)] +
                [unavail_time("w2", d,  0, 11) for d in range(3)] +
                [unavail_time("w2", d, 19, 24) for d in range(3)] +
                [unavail_time("w3", d,  0, 14) for d in range(3)] +
                [unavail_time("w4", d,  0, 17) for d in range(3)] +
                [unavail_day("w5", 2)]
            ),
            "settings": DEFAULT_SETTINGS, "balance_hours": True, "minimize_changes": False,
        },
    }


# ═══ GROUP F · ADVANCED & PRODUCTION SCALE ════════════════════════════

def s25():
    return {
        "title": "25 · Mon–Fri Restaurant — 6 Workers, 4 Roles",
        "description": (
            "Full restaurant week: Cook, Waiter, Bartender, Host. Alice off Wed, Dave only after 14:00 all week, "
            "Frank off Mon & Fri. V2 assigns spanning shifts across adjacent windows where workers have wide availability."
        ),
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": end_date(4),
            "workers": [
                w("w1", "Alice", ["Cook", "Waiter"],      {"Cook": 9, "Waiter": 5}),
                w("w2", "Bob",   ["Waiter", "Bartender"], {"Waiter": 8, "Bartender": 7}),
                w("w3", "Carol", ["Cook", "Host"],         {"Cook": 7, "Host": 8}),
                w("w4", "Dave",  ["Waiter", "Bartender"], {"Waiter": 6, "Bartender": 9}),
                w("w5", "Eve",   ["Waiter", "Host"],       {"Waiter": 7, "Host": 6}),
                w("w6", "Frank", ["Cook", "Waiter"],       {"Cook": 8, "Waiter": 6}),
            ],
            "coverage_windows": sum(([
                cov(f"cook-am{d}", "Cook",      d, 10, 14),
                cov(f"cook-pm{d}", "Cook",      d, 14, 18),
                cov(f"wait-am{d}", "Waiter",    d, 10, 15),
                cov(f"wait-pm{d}", "Waiter",    d, 15, 22),
                cov(f"bar{d}",     "Bartender", d, 17, 23),
                cov(f"host{d}",    "Host",      d, 10, 18),
            ] for d in range(5)), []),
            "unavailability": (
                [unavail_day("w1", 2)] +
                [unavail_time("w4", d, 0, 14) for d in range(5)] +
                [unavail_day("w6", 0), unavail_day("w6", 4)]
            ),
            "settings": DEFAULT_SETTINGS, "balance_hours": True, "minimize_changes": False,
        },
    }

def s26():
    return {
        "title": "26 · 8 Waiters, 3 Shifts/Day — Proportional Balance Full Week",
        "description": (
            "Eight waiters share morning (07–12), midday (12–17), evening (17–23) slots Mon–Fri. "
            "Several workers have restricted days/times. V2 proportional balancing distributes "
            "hours according to each worker's actual availability across the horizon."
        ),
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": end_date(4),
            "workers": [w(f"w{i}", n, ["Waiter"], {"Waiter": 7})
                        for i, n in enumerate(["Alice","Bob","Carol","Dave","Eve","Frank","Grace","Henry"], 1)],
            "coverage_windows": sum(([
                cov(f"am{d}",  "Waiter", d,  7, 12),
                cov(f"mid{d}", "Waiter", d, 12, 17),
                cov(f"pm{d}",  "Waiter", d, 17, 23),
            ] for d in range(5)), []),
            "unavailability": [
                unavail_time("w1", 0, 17, 24),
                unavail_day("w2", 2),
                unavail_time("w4", 1, 0, 12),
                unavail_day("w6", 4),
                unavail_time("w7", 3, 0, 17),
                unavail_day("w8", 0),
            ],
            "settings": DEFAULT_SETTINGS, "balance_hours": True, "minimize_changes": False,
        },
    }

def s27():
    return {
        "title": "27 · [V2] Repair Mode — Minimise Changes to Existing Schedule",
        "description": (
            "V2 FEATURE: An existing schedule has Alice on Cook Mon 10–18 and Bob on Waiter Mon 10–18. "
            "Tuesday is added. Solver keeps Monday assignments (minimize_changes=True) "
            "while freely scheduling Tuesday from scratch."
        ),
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": end_date(1),
            "workers": [
                w("w1", "Alice", ["Cook", "Waiter"], {"Cook": 9, "Waiter": 6}),
                w("w2", "Bob",   ["Cook", "Waiter"], {"Cook": 7, "Waiter": 8}),
                w("w3", "Carol", ["Waiter"],          {"Waiter": 7}),
            ],
            "coverage_windows": [
                cov("cook-am0", "Cook",   0, 10, 14), cov("cook-pm0", "Cook",   0, 14, 18),
                cov("wait-am0", "Waiter", 0, 10, 15), cov("wait-pm0", "Waiter", 0, 15, 21),
                cov("cook-am1", "Cook",   1, 10, 14), cov("cook-pm1", "Cook",   1, 14, 18),
                cov("wait-am1", "Waiter", 1, 10, 15), cov("wait-pm1", "Waiter", 1, 15, 21),
            ],
            "existing_assignments": [
                {"worker_id": "w1", "skill_id": "Cook",   "day": 0, "start_minutes": 600, "end_minutes": 1080, "is_locked": False},
                {"worker_id": "w2", "skill_id": "Waiter", "day": 0, "start_minutes": 600, "end_minutes": 1260, "is_locked": False},
            ],
            "settings": DEFAULT_SETTINGS, "minimize_changes": True, "balance_hours": True,
        },
    }

def s28():
    return {
        "title": "28 · [V2] Cross-Window — Night Shift Spanning Evening + Late",
        "description": (
            "V2 FEATURE: Two adjacent bartender windows (18:00–22:00 and 22:00–02:00). "
            "Alice is the only available bartender, free 18:00–02:00 (max_hours=8). "
            "Solver assigns a single 8h spanning shift 18:00–02:00 — not two separate 4h blocks."
        ),
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [
                w("w1", "Alice", ["Bartender"], {"Bartender": 9}),
            ],
            "coverage_windows": [
                cov("eve",  "Bartender", 0, 18, 22),
                cov("late", "Bartender", 0, 22, 26),
            ],
            "unavailability": [
                unavail_time("w1", 0, 0, 18),
            ],
            "settings": {**DEFAULT_SETTINGS, "max_hours_per_block": 8},
            "balance_hours": False, "minimize_changes": False,
        },
    }

def s29():
    return {
        "title": "29 · Full Diner Week — 7 Workers, 5 Roles, Complex Constraints",
        "description": (
            "Seven workers at a diner Mon–Fri. Roles: Cook, Waiter, Bartender, Dishes, Host. "
            "Alice mornings only, Carol afternoons, Dave evenings, Eve Mon/Wed/Fri only, "
            "Frank no mornings, Grace Tue–Thu only. V2 cross-window + proportional balance throughout."
        ),
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": end_date(4),
            "workers": [
                w("w1", "Alice", ["Cook", "Dishes"],           {"Cook": 9, "Dishes": 5}),
                w("w2", "Bob",   ["Cook", "Waiter", "Dishes"], {"Cook": 7, "Waiter": 8, "Dishes": 6}),
                w("w3", "Carol", ["Waiter", "Bartender"],       {"Waiter": 7, "Bartender": 9}),
                w("w4", "Dave",  ["Bartender", "Dishes"],       {"Bartender": 7, "Dishes": 8}),
                w("w5", "Eve",   ["Waiter", "Cook"],            {"Waiter": 6, "Cook": 8}),
                w("w6", "Frank", ["Waiter", "Host"],            {"Waiter": 8, "Host": 7}),
                w("w7", "Grace", ["Dishes", "Host"],            {"Dishes": 9, "Host": 6}),
            ],
            "coverage_windows": sum(([
                cov(f"cook-am{d}", "Cook",      d, 10, 14),
                cov(f"cook-pm{d}", "Cook",      d, 14, 18),
                cov(f"wait-am{d}", "Waiter",    d, 10, 16),
                cov(f"wait-pm{d}", "Waiter",    d, 16, 22),
                cov(f"bar{d}",     "Bartender", d, 17, 23),
                cov(f"dish{d}",    "Dishes",    d, 12, 20),
                cov(f"host{d}",    "Host",      d, 10, 18),
            ] for d in range(5)), []),
            "unavailability": (
                [unavail_time("w1", d, 14, 24) for d in range(5)] +
                [unavail_time("w3", d,  0, 14) for d in range(5)] +
                [unavail_time("w4", d,  0, 17) for d in range(5)] +
                [unavail_day("w5", 1), unavail_day("w5", 3)] +
                [unavail_time("w6", d,  0, 12) for d in range(5)] +
                [unavail_day("w7", 0), unavail_day("w7", 4)]
            ),
            "settings": DEFAULT_SETTINGS, "balance_hours": True, "minimize_changes": False,
        },
    }

def s30():
    return {
        "title": "30 · Production Scale — 10 Workers, 6 Roles, Full Week",
        "description": (
            "The largest scenario: 10 workers, 6 roles (Head Chef, Line Cook, Waiter×2, Bartender, Host) Mon–Fri. "
            "Parallel workers in peak windows, complex partial-day constraints throughout. "
            "Tests CP-SAT performance and solution quality at real production scale."
        ),
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": end_date(4),
            "workers": [
                w("w1",  "Alice",  ["Head Chef"],              {"Head Chef": 9}),
                w("w2",  "Bob",    ["Line Cook", "Head Chef"], {"Line Cook": 8, "Head Chef": 6}),
                w("w3",  "Carol",  ["Line Cook", "Waiter"],    {"Line Cook": 7, "Waiter": 6}),
                w("w4",  "Dave",   ["Waiter", "Host"],          {"Waiter": 8, "Host": 6}),
                w("w5",  "Eve",    ["Waiter"],                  {"Waiter": 9}),
                w("w6",  "Frank",  ["Waiter", "Bartender"],    {"Waiter": 6, "Bartender": 8}),
                w("w7",  "Grace",  ["Bartender"],               {"Bartender": 9}),
                w("w8",  "Henry",  ["Host", "Waiter"],          {"Host": 8, "Waiter": 5}),
                w("w9",  "Irene",  ["Waiter", "Line Cook"],    {"Waiter": 7, "Line Cook": 6}),
                w("w10", "Jake",   ["Bartender", "Host"],      {"Bartender": 7, "Host": 7}),
            ],
            "coverage_windows": sum(([
                cov(f"chef-am{d}", "Head Chef", d, 10, 14),
                cov(f"chef-pm{d}", "Head Chef", d, 14, 18),
                cov(f"line{d}",    "Line Cook", d, 10, 18),
                cov(f"wait-am{d}", "Waiter",    d, 10, 15, min_w=2),
                cov(f"wait-pm{d}", "Waiter",    d, 15, 22, min_w=2),
                cov(f"bar{d}",     "Bartender", d, 17, 23),
                cov(f"host{d}",    "Host",      d, 10, 20),
            ] for d in range(5)), []),
            "unavailability": (
                [unavail_time("w1",  d, 15, 24) for d in range(5)] +
                [unavail_day("w3",  0)] +
                [unavail_time("w3",  d,  0, 14) for d in range(1, 5)] +
                [unavail_day("w5",  4)] +
                [unavail_time("w6",  d,  0, 16) for d in range(5)] +
                [unavail_day("w7",  1)] +
                [unavail_time("w8",  d, 14, 24) for d in range(5)] +
                [unavail_time("w9",  3,  0, 14)] +
                [unavail_day("w10", 0), unavail_day("w10", 4)]
            ),
            "settings": DEFAULT_SETTINGS, "balance_hours": True, "minimize_changes": False,
        },
    }


ALL_SCENARIOS = [
    s01, s02, s03, s04, s05, s06, s07, s08, s09, s10,
    s11, s12, s13, s14, s15, s16, s17, s18, s19, s20,
    s21, s22, s23, s24, s25, s26, s27, s28, s29, s30,
]
