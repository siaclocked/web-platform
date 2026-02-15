"""
Scenario definitions for visual solver tests.
20 scenarios with gradually increasing complexity and granular availability.
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
MON = next_monday().weekday()

DEFAULT_SETTINGS = {
    "max_hours_per_day": 12,
    "min_hours_per_block": 2,
    "max_hours_per_block": 10,
    "min_rest_between_shifts": 8,
    "granularity_minutes": 15,
}

def w(id, name, skills, ratings=None):
    return {
        "id": id, "name": name, "skill_ids": skills,
        "place_ids": ["place-1"],
        "skill_ratings": ratings or {s: 5 for s in skills},
    }

def cov(id, skill, day, start_h, end_h, min_w=1):
    return {
        "id": id, "skill_id": skill, "day": day,
        "start_minutes": start_h * 60, "end_minutes": end_h * 60,
        "min_workers": min_w,
    }

def unavail_day(worker_id, day):
    return {"worker_id": worker_id, "day": day, "is_full_day": True}

def unavail_time(worker_id, day, start_h, end_h):
    return {"worker_id": worker_id, "day": day, "start_minutes": start_h * 60,
            "end_minutes": end_h * 60, "is_full_day": False}

def end_date(days):
    return (next_monday() + timedelta(days=days)).isoformat()


# ─── SCENARIOS ─────────────────────────────────────────────────────────────────

def s01():
    """1 worker, 1 role, 1 day"""
    return {
        "title": "1 · One Worker, One Shift",
        "description": "Simplest case: Alice covers a single Monday waiter shift 10:00–18:00.",
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [w("w1", "Alice", ["Waiter"], {"Waiter": 7})],
            "coverage_windows": [cov("c1", "Waiter", MON, 10, 18)],
            "settings": DEFAULT_SETTINGS,
        },
    }

def s02():
    """2 workers, AM/PM split, 1 day"""
    return {
        "title": "2 · AM/PM Split",
        "description": "Two waiters split Monday: Alice 08:00–15:00, Bob 15:00–22:00.",
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [
                w("w1", "Alice", ["Waiter"], {"Waiter": 8}),
                w("w2", "Bob", ["Waiter"], {"Waiter": 6}),
            ],
            "coverage_windows": [
                cov("am", "Waiter", MON, 8, 15),
                cov("pm", "Waiter", MON, 15, 22),
            ],
            "balance_hours": True,
            "settings": DEFAULT_SETTINGS,
        },
    }

def s03():
    """2 workers, 2 roles, 1 day"""
    return {
        "title": "3 · Two Roles — Cook & Waiter",
        "description": "Alice is a cook, Bob is a waiter. Both work 10:00–18:00 in parallel.",
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [
                w("w1", "Alice", ["Cook"], {"Cook": 9}),
                w("w2", "Bob", ["Waiter"], {"Waiter": 7}),
            ],
            "coverage_windows": [
                cov("cook", "Cook", MON, 10, 18),
                cov("wait", "Waiter", MON, 10, 18),
            ],
            "balance_hours": True,
            "settings": DEFAULT_SETTINGS,
        },
    }

def s04():
    """2 workers, 1 full-day unavailability"""
    return {
        "title": "4 · Full-Day Unavailability",
        "description": "Alice is off Monday entirely. Bob must cover the shift alone.",
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [
                w("w1", "Alice", ["Waiter"], {"Waiter": 9}),
                w("w2", "Bob", ["Waiter"], {"Waiter": 6}),
            ],
            "coverage_windows": [cov("c1", "Waiter", MON, 9, 17)],
            "unavailability": [unavail_day("w1", MON)],
            "balance_hours": True,
            "settings": DEFAULT_SETTINGS,
        },
    }

def s05():
    """2 workers, partial-day unavailability, 1 day"""
    return {
        "title": "5 · Morning Unavailability",
        "description": "Alice can only work after 13:00 on Monday. Bob is available all day. "
                       "The solver must put Bob on the morning shift and Alice on the afternoon.",
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [
                w("w1", "Alice", ["Waiter"], {"Waiter": 8}),
                w("w2", "Bob", ["Waiter"], {"Waiter": 7}),
            ],
            "coverage_windows": [
                cov("am", "Waiter", MON, 8, 14),
                cov("pm", "Waiter", MON, 14, 22),
            ],
            "unavailability": [unavail_time("w1", MON, 0, 13)],
            "balance_hours": True,
            "settings": DEFAULT_SETTINGS,
        },
    }

def s06():
    """3 workers, 2 roles, staggered shifts, 1 day"""
    return {
        "title": "6 · Staggered Shifts — 3 Workers, 2 Roles",
        "description": "A cook works 10:00–18:00. Two waiters split: one 10:00–16:00, another 16:00–22:00. "
                       "Shows parallel roles on the same day.",
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [
                w("w1", "Alice", ["Cook"], {"Cook": 9}),
                w("w2", "Bob", ["Waiter"], {"Waiter": 8}),
                w("w3", "Carol", ["Waiter"], {"Waiter": 7}),
            ],
            "coverage_windows": [
                cov("cook", "Cook", MON, 10, 18),
                cov("wait-am", "Waiter", MON, 10, 16),
                cov("wait-pm", "Waiter", MON, 16, 22),
            ],
            "balance_hours": True,
            "settings": DEFAULT_SETTINGS,
        },
    }

def s07():
    """3 workers, partial availability for each, 1 day"""
    return {
        "title": "7 · Everyone Has Partial Availability",
        "description": "Alice only available 08:00–14:00, Bob 12:00–20:00, Carol 16:00–23:00. "
                       "Coverage needs a waiter 08:00–14:00, 14:00–20:00, and 20:00–23:00.",
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [
                w("w1", "Alice", ["Waiter"], {"Waiter": 8}),
                w("w2", "Bob", ["Waiter"], {"Waiter": 7}),
                w("w3", "Carol", ["Waiter"], {"Waiter": 9}),
            ],
            "coverage_windows": [
                cov("early", "Waiter", MON, 8, 14),
                cov("mid", "Waiter", MON, 14, 20),
                cov("late", "Waiter", MON, 20, 23),
            ],
            "unavailability": [
                unavail_time("w1", MON, 14, 24),
                unavail_time("w2", MON, 0, 12),
                unavail_time("w2", MON, 20, 24),
                unavail_time("w3", MON, 0, 16),
            ],
            "balance_hours": True,
            "settings": DEFAULT_SETTINGS,
        },
    }

def s08():
    """4 workers, 3 roles, overlapping skills, 1 day"""
    return {
        "title": "8 · Skill Puzzle — Overlapping Qualifications",
        "description": "Four workers with overlapping skills fill Cook, Waiter, and Bartender. "
                       "Alice: Cook(9)/Waiter(4), Bob: Waiter(7)/Bartender(8), Carol: Cook(6)/Bartender(5), Dave: Waiter(8). "
                       "The solver must optimise skill ratings.",
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [
                w("w1", "Alice", ["Cook", "Waiter"], {"Cook": 9, "Waiter": 4}),
                w("w2", "Bob", ["Waiter", "Bartender"], {"Waiter": 7, "Bartender": 8}),
                w("w3", "Carol", ["Cook", "Bartender"], {"Cook": 6, "Bartender": 5}),
                w("w4", "Dave", ["Waiter"], {"Waiter": 8}),
            ],
            "coverage_windows": [
                cov("cook", "Cook", MON, 10, 18),
                cov("wait", "Waiter", MON, 10, 18),
                cov("bar", "Bartender", MON, 16, 23),
            ],
            "balance_hours": True,
            "settings": DEFAULT_SETTINGS,
        },
    }

def s09():
    """2 workers, understaffed — coverage gaps, 1 day"""
    return {
        "title": "9 · Understaffed — Coverage Gaps",
        "description": "Manager needs 3 waiters per shift but only 2 are available. "
                       "The solver reports coverage gaps.",
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [
                w("w1", "Alice", ["Waiter"], {"Waiter": 8}),
                w("w2", "Bob", ["Waiter"], {"Waiter": 7}),
            ],
            "coverage_windows": [
                cov("c1", "Waiter", MON, 10, 18, min_w=3),
            ],
            "balance_hours": True,
            "settings": DEFAULT_SETTINGS,
        },
    }

def s10():
    """3 workers, 2 days, mixed partial availability"""
    TUE = (MON + 1) % 7
    return {
        "title": "10 · Two Days with Mixed Availability",
        "description": "Mon–Tue scheduling. Alice: Mon only mornings (off after 14:00), Tue all day. "
                       "Bob: Mon all day, Tue only evenings (off before 16:00). "
                       "Carol: available both days fully. Two waiter shifts per day.",
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": end_date(1),
            "workers": [
                w("w1", "Alice", ["Waiter"], {"Waiter": 8}),
                w("w2", "Bob", ["Waiter"], {"Waiter": 7}),
                w("w3", "Carol", ["Waiter"], {"Waiter": 6}),
            ],
            "coverage_windows": [
                cov("mon-am", "Waiter", MON, 9, 15),
                cov("mon-pm", "Waiter", MON, 15, 21),
                cov("tue-am", "Waiter", TUE, 9, 15),
                cov("tue-pm", "Waiter", TUE, 15, 21),
            ],
            "unavailability": [
                unavail_time("w1", MON, 14, 24),
                unavail_time("w2", TUE, 0, 16),
            ],
            "balance_hours": True,
            "settings": DEFAULT_SETTINGS,
        },
    }

def s11():
    """4 workers, 3 roles, 2 parallel waiters, 1 day"""
    return {
        "title": "11 · Parallel Workers in Same Role",
        "description": "Lunch rush needs 2 waiters 11:00–15:00 in parallel. "
                       "Plus a cook 10:00–18:00 and a bartender 16:00–22:00. "
                       "Shows stacked workers in the waiter swimlane.",
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [
                w("w1", "Alice", ["Cook"], {"Cook": 9}),
                w("w2", "Bob", ["Waiter"], {"Waiter": 8}),
                w("w3", "Carol", ["Waiter"], {"Waiter": 7}),
                w("w4", "Dave", ["Bartender"], {"Bartender": 8}),
            ],
            "coverage_windows": [
                cov("cook", "Cook", MON, 10, 18),
                cov("wait", "Waiter", MON, 11, 15, min_w=2),
                cov("bar", "Bartender", MON, 16, 22),
            ],
            "balance_hours": True,
            "settings": DEFAULT_SETTINGS,
        },
    }

def s12():
    """5 workers, 3 roles, partial availability, 1 day"""
    return {
        "title": "12 · Five Workers, Varied Hours",
        "description": "Five staff with different availability windows on Monday. "
                       "Alice: 08–14 only. Bob: 12–20. Carol: 10–16. Dave: 14–22. Eve: 16–23. "
                       "Roles: Cook (10–18), Waiter AM (10–15), Waiter PM (15–22), Bartender (17–23).",
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": START,
            "workers": [
                w("w1", "Alice", ["Cook", "Waiter"], {"Cook": 8, "Waiter": 6}),
                w("w2", "Bob", ["Waiter", "Bartender"], {"Waiter": 7, "Bartender": 8}),
                w("w3", "Carol", ["Cook", "Waiter"], {"Cook": 7, "Waiter": 5}),
                w("w4", "Dave", ["Waiter", "Bartender"], {"Waiter": 9, "Bartender": 6}),
                w("w5", "Eve", ["Bartender", "Waiter"], {"Bartender": 9, "Waiter": 4}),
            ],
            "coverage_windows": [
                cov("cook", "Cook", MON, 10, 18),
                cov("wait-am", "Waiter", MON, 10, 15),
                cov("wait-pm", "Waiter", MON, 15, 22),
                cov("bar", "Bartender", MON, 17, 23),
            ],
            "unavailability": [
                unavail_time("w1", MON, 14, 24),
                unavail_time("w2", MON, 0, 12),
                unavail_time("w3", MON, 16, 24),
                unavail_time("w4", MON, 0, 14),
                unavail_time("w5", MON, 0, 16),
            ],
            "balance_hours": True,
            "settings": DEFAULT_SETTINGS,
        },
    }

def s13():
    """4 workers, locked assignment, 2 days"""
    TUE = (MON + 1) % 7
    return {
        "title": "13 · Locked Assignment with Partial Availability",
        "description": "Alice is locked as Cook on Monday 10–18. On Tuesday she's only available 14–22. "
                       "Bob and Carol have partial availability too. The solver must respect all constraints.",
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": end_date(1),
            "workers": [
                w("w1", "Alice", ["Cook", "Waiter"], {"Cook": 9, "Waiter": 6}),
                w("w2", "Bob", ["Cook", "Waiter"], {"Cook": 7, "Waiter": 8}),
                w("w3", "Carol", ["Waiter"], {"Waiter": 7}),
            ],
            "coverage_windows": [
                cov("cook-mon", "Cook", MON, 10, 18),
                cov("wait-mon", "Waiter", MON, 10, 18),
                cov("cook-tue", "Cook", TUE, 10, 18),
                cov("wait-tue", "Waiter", TUE, 10, 18),
            ],
            "existing_assignments": [
                {"worker_id": "w1", "skill_id": "Cook", "day": MON,
                 "start_minutes": 600, "end_minutes": 1080, "is_locked": True},
            ],
            "unavailability": [
                unavail_time("w1", TUE, 0, 14),
                unavail_time("w2", MON, 0, 12),
                unavail_time("w3", TUE, 18, 24),
            ],
            "minimize_changes": True,
            "balance_hours": True,
            "settings": DEFAULT_SETTINGS,
        },
    }

def s14():
    """5 workers, 3 roles, Mon–Wed, heavy partial constraints"""
    TUE = (MON + 1) % 7
    WED = (MON + 2) % 7
    return {
        "title": "14 · Three-Day Schedule — Tight Availability",
        "description": "Mon–Wed with 5 workers. Each worker has specific hour windows per day. "
                       "Alice: mornings only (8–14). Bob: midday (11–19). Carol: afternoons (14–22). "
                       "Dave: evenings (17–23). Eve: flexible but off Wednesday entirely.",
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": end_date(2),
            "workers": [
                w("w1", "Alice", ["Waiter", "Host"], {"Waiter": 7, "Host": 8}),
                w("w2", "Bob", ["Cook", "Waiter"], {"Cook": 8, "Waiter": 6}),
                w("w3", "Carol", ["Waiter", "Bartender"], {"Waiter": 7, "Bartender": 9}),
                w("w4", "Dave", ["Bartender", "Waiter"], {"Bartender": 7, "Waiter": 5}),
                w("w5", "Eve", ["Cook", "Host"], {"Cook": 9, "Host": 6}),
            ],
            "coverage_windows": sum(([
                cov(f"cook-d{d}", "Cook", (MON+d)%7, 10, 18),
                cov(f"wait-am-d{d}", "Waiter", (MON+d)%7, 10, 16),
                cov(f"wait-pm-d{d}", "Waiter", (MON+d)%7, 16, 22),
                cov(f"bar-d{d}", "Bartender", (MON+d)%7, 17, 23),
            ] for d in range(3)), []),
            "unavailability": [
                unavail_time("w1", MON, 14, 24), unavail_time("w1", TUE, 14, 24), unavail_time("w1", WED, 14, 24),
                unavail_time("w2", MON, 0, 11), unavail_time("w2", MON, 19, 24),
                unavail_time("w2", TUE, 0, 11), unavail_time("w2", TUE, 19, 24),
                unavail_time("w2", WED, 0, 11), unavail_time("w2", WED, 19, 24),
                unavail_time("w3", MON, 0, 14), unavail_time("w3", TUE, 0, 14), unavail_time("w3", WED, 0, 14),
                unavail_time("w4", MON, 0, 17), unavail_time("w4", TUE, 0, 17), unavail_time("w4", WED, 0, 17),
                unavail_day("w5", WED),
            ],
            "balance_hours": True,
            "settings": DEFAULT_SETTINGS,
        },
    }

def s15():
    """6 workers, 4 roles, full week Mon–Fri"""
    return {
        "title": "15 · Restaurant Week — 6 Workers, 4 Roles",
        "description": "A restaurant running Mon–Fri with Cook, Waiter, Bartender, Host. "
                       "Six workers with varied skills. Alice off Wed, Dave only available after 14:00 all week, "
                       "Frank off Mon and Fri.",
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": end_date(4),
            "workers": [
                w("w1", "Alice", ["Cook", "Waiter"], {"Cook": 9, "Waiter": 5}),
                w("w2", "Bob", ["Waiter", "Bartender"], {"Waiter": 8, "Bartender": 7}),
                w("w3", "Carol", ["Cook", "Host"], {"Cook": 7, "Host": 8}),
                w("w4", "Dave", ["Waiter", "Bartender"], {"Waiter": 6, "Bartender": 9}),
                w("w5", "Eve", ["Waiter", "Host"], {"Waiter": 7, "Host": 6}),
                w("w6", "Frank", ["Cook", "Waiter"], {"Cook": 8, "Waiter": 6}),
            ],
            "coverage_windows": sum(([
                cov(f"cook-d{d}", "Cook", (MON+d)%7, 10, 18),
                cov(f"wait-am-d{d}", "Waiter", (MON+d)%7, 10, 15),
                cov(f"wait-pm-d{d}", "Waiter", (MON+d)%7, 15, 22),
                cov(f"bar-d{d}", "Bartender", (MON+d)%7, 17, 23),
                cov(f"host-d{d}", "Host", (MON+d)%7, 10, 18),
            ] for d in range(5)), []),
            "unavailability": [
                unavail_day("w1", (MON+2)%7),
            ] + [
                unavail_time("w4", (MON+d)%7, 0, 14) for d in range(5)
            ] + [
                unavail_day("w6", MON),
                unavail_day("w6", (MON+4)%7),
            ],
            "balance_hours": True,
            "settings": DEFAULT_SETTINGS,
        },
    }

def s16():
    """8 workers, 3 shifts/day, Mon–Fri, hour balancing"""
    return {
        "title": "16 · Large Team — 8 Waiters, 3 Shifts/Day",
        "description": "Eight waiters share morning (7–12), midday (12–17), and evening (17–23) shifts Mon–Fri. "
                       "Several workers have restricted hours. The solver balances total hours across the team.",
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": end_date(4),
            "workers": [
                w("w0", "Alice", ["Waiter"], {"Waiter": 9}),
                w("w1", "Bob", ["Waiter"], {"Waiter": 7}),
                w("w2", "Carol", ["Waiter"], {"Waiter": 8}),
                w("w3", "Dave", ["Waiter"], {"Waiter": 6}),
                w("w4", "Eve", ["Waiter"], {"Waiter": 7}),
                w("w5", "Frank", ["Waiter"], {"Waiter": 8}),
                w("w6", "Grace", ["Waiter"], {"Waiter": 5}),
                w("w7", "Henry", ["Waiter"], {"Waiter": 9}),
            ],
            "coverage_windows": sum(([
                cov(f"am-d{d}", "Waiter", (MON+d)%7, 7, 12),
                cov(f"mid-d{d}", "Waiter", (MON+d)%7, 12, 17),
                cov(f"pm-d{d}", "Waiter", (MON+d)%7, 17, 23),
            ] for d in range(5)), []),
            "unavailability": [
                unavail_time("w0", MON, 17, 24),
                unavail_day("w1", (MON+2)%7),
                unavail_time("w3", (MON+1)%7, 0, 12),
                unavail_day("w5", (MON+4)%7),
                unavail_time("w6", (MON+3)%7, 0, 17),
                unavail_day("w7", (MON+0)%7),
            ],
            "balance_hours": True,
            "settings": DEFAULT_SETTINGS,
        },
    }

def s17():
    """Weekend café — Sat & Sun, 6 workers, 3 roles"""
    return {
        "title": "17 · Weekend Café — Sat & Sun",
        "description": "Six workers staff a café Sat–Sun. Barista, Waiter (2 needed), Host. "
                       "Bob and Dave unavailable Sunday. Alice only available mornings on Sat.",
        "request": {
            "place_id": "place-1",
            "start_date": (next_monday() + timedelta(days=5)).isoformat(),
            "end_date": (next_monday() + timedelta(days=6)).isoformat(),
            "workers": [
                w("w1", "Alice", ["Barista", "Waiter"], {"Barista": 9, "Waiter": 6}),
                w("w2", "Bob", ["Waiter"], {"Waiter": 8}),
                w("w3", "Carol", ["Waiter", "Host"], {"Waiter": 7, "Host": 8}),
                w("w4", "Dave", ["Barista"], {"Barista": 7}),
                w("w5", "Eve", ["Host", "Waiter"], {"Host": 9, "Waiter": 5}),
                w("w6", "Frank", ["Waiter", "Barista"], {"Waiter": 6, "Barista": 8}),
            ],
            "coverage_windows": [
                cov("bar-sat", "Barista", 5, 8, 16),
                cov("wait-sat-am", "Waiter", 5, 8, 14, min_w=2),
                cov("wait-sat-pm", "Waiter", 5, 14, 20, min_w=2),
                cov("host-sat", "Host", 5, 10, 18),
                cov("bar-sun", "Barista", 6, 9, 15),
                cov("wait-sun", "Waiter", 6, 9, 15, min_w=2),
                cov("host-sun", "Host", 6, 9, 15),
            ],
            "unavailability": [
                unavail_day("w2", 6),
                unavail_day("w4", 6),
                unavail_time("w1", 5, 14, 24),
            ],
            "balance_hours": True,
            "settings": DEFAULT_SETTINGS,
        },
    }

def s18():
    """7 workers, 4 roles, Mon–Fri, complex partial availability"""
    return {
        "title": "18 · Diner Full Week — Complex Partial Availability",
        "description": "Seven workers at a diner Mon–Fri. Roles: Cook, Waiter, Bartender, Dishes. "
                       "Each worker has specific time windows they can work. "
                       "Alice: mornings only. Bob: flexible. Carol: afternoons. Dave: evenings. "
                       "Eve: Mon/Wed/Fri only. Frank: no mornings. Grace: Tue–Thu only.",
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": end_date(4),
            "workers": [
                w("w1", "Alice", ["Cook", "Dishes"], {"Cook": 9, "Dishes": 5}),
                w("w2", "Bob", ["Cook", "Waiter", "Dishes"], {"Cook": 7, "Waiter": 8, "Dishes": 6}),
                w("w3", "Carol", ["Waiter", "Bartender"], {"Waiter": 7, "Bartender": 9}),
                w("w4", "Dave", ["Bartender", "Dishes"], {"Bartender": 7, "Dishes": 8}),
                w("w5", "Eve", ["Waiter", "Cook"], {"Waiter": 6, "Cook": 8}),
                w("w6", "Frank", ["Waiter", "Bartender"], {"Waiter": 8, "Bartender": 6}),
                w("w7", "Grace", ["Dishes", "Waiter"], {"Dishes": 9, "Waiter": 5}),
            ],
            "coverage_windows": sum(([
                cov(f"cook-d{d}", "Cook", (MON+d)%7, 10, 18),
                cov(f"wait-am-d{d}", "Waiter", (MON+d)%7, 10, 16),
                cov(f"wait-pm-d{d}", "Waiter", (MON+d)%7, 16, 22),
                cov(f"bar-d{d}", "Bartender", (MON+d)%7, 17, 23),
                cov(f"dish-d{d}", "Dishes", (MON+d)%7, 12, 22),
            ] for d in range(5)), []),
            "unavailability":
                [unavail_time("w1", (MON+d)%7, 14, 24) for d in range(5)] +
                [unavail_time("w3", (MON+d)%7, 0, 14) for d in range(5)] +
                [unavail_time("w4", (MON+d)%7, 0, 17) for d in range(5)] +
                [unavail_day("w5", (MON+1)%7), unavail_day("w5", (MON+3)%7)] +
                [unavail_time("w6", (MON+d)%7, 0, 12) for d in range(5)] +
                [unavail_day("w7", MON), unavail_day("w7", (MON+4)%7)],
            "balance_hours": True,
            "settings": DEFAULT_SETTINGS,
        },
    }

def s19():
    """8 workers, 5 roles, 2 parallel in some roles, Mon–Fri"""
    return {
        "title": "19 · Full Restaurant — Multiple Parallel Workers",
        "description": "Eight workers across 5 roles Mon–Fri. Kitchen needs 2 cooks in parallel during lunch. "
                       "Service needs 2 waiters 12–15 for lunch rush. "
                       "Complex availability: Alice mornings only, Dave evenings only, Henry off Mon/Fri.",
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": end_date(4),
            "workers": [
                w("w1", "Alice", ["Cook"], {"Cook": 9}),
                w("w2", "Bob", ["Cook", "Waiter"], {"Cook": 7, "Waiter": 8}),
                w("w3", "Carol", ["Waiter", "Host"], {"Waiter": 8, "Host": 7}),
                w("w4", "Dave", ["Bartender", "Waiter"], {"Bartender": 9, "Waiter": 5}),
                w("w5", "Eve", ["Waiter"], {"Waiter": 7}),
                w("w6", "Frank", ["Cook", "Dishes"], {"Cook": 6, "Dishes": 8}),
                w("w7", "Grace", ["Host", "Dishes"], {"Host": 9, "Dishes": 7}),
                w("w8", "Henry", ["Waiter", "Bartender"], {"Waiter": 6, "Bartender": 7}),
            ],
            "coverage_windows": sum(([
                cov(f"cook-am-d{d}", "Cook", (MON+d)%7, 10, 15, min_w=2),
                cov(f"cook-pm-d{d}", "Cook", (MON+d)%7, 15, 20),
                cov(f"wait-lunch-d{d}", "Waiter", (MON+d)%7, 11, 15, min_w=2),
                cov(f"wait-dinner-d{d}", "Waiter", (MON+d)%7, 17, 22),
                cov(f"bar-d{d}", "Bartender", (MON+d)%7, 17, 23),
                cov(f"host-d{d}", "Host", (MON+d)%7, 11, 20),
                cov(f"dish-d{d}", "Dishes", (MON+d)%7, 12, 22),
            ] for d in range(5)), []),
            "unavailability":
                [unavail_time("w1", (MON+d)%7, 15, 24) for d in range(5)] +
                [unavail_time("w4", (MON+d)%7, 0, 17) for d in range(5)] +
                [unavail_day("w8", MON), unavail_day("w8", (MON+4)%7)] +
                [unavail_time("w6", (MON+d)%7, 0, 12) for d in range(5)] +
                [unavail_day("w5", (MON+2)%7)],
            "balance_hours": True,
            "settings": DEFAULT_SETTINGS,
        },
    }

def s20():
    """10 workers, 5 roles, Mon–Fri, production-scale"""
    return {
        "title": "20 · Production Scale — 10 Workers, 5 Roles, Full Week",
        "description": "A large restaurant with 10 workers and 5 roles: Head Chef, Line Cook, Waiter, Bartender, Host. "
                       "Multiple parallel workers needed. Extensive partial-day availability constraints. "
                       "Alice: mornings. Bob: flexible. Carol: off Mon, afternoons only. Dave: all day. "
                       "Eve: off Fri. Frank: evenings only. Grace: off Tue. Henry: mornings only. "
                       "Irene: off Thu mornings. Jake: off Mon and Fri.",
        "request": {
            "place_id": "place-1", "start_date": START, "end_date": end_date(4),
            "workers": [
                w("w1",  "Alice", ["Head Chef"],              {"Head Chef": 9}),
                w("w2",  "Bob",   ["Line Cook", "Head Chef"], {"Line Cook": 8, "Head Chef": 6}),
                w("w3",  "Carol", ["Line Cook", "Waiter"],    {"Line Cook": 7, "Waiter": 6}),
                w("w4",  "Dave",  ["Waiter", "Host"],         {"Waiter": 8, "Host": 6}),
                w("w5",  "Eve",   ["Waiter"],                 {"Waiter": 9}),
                w("w6",  "Frank", ["Waiter", "Bartender"],    {"Waiter": 6, "Bartender": 8}),
                w("w7",  "Grace", ["Bartender"],              {"Bartender": 9}),
                w("w8",  "Henry", ["Host", "Waiter"],         {"Host": 8, "Waiter": 5}),
                w("w9",  "Irene", ["Waiter", "Line Cook"],    {"Waiter": 7, "Line Cook": 6}),
                w("w10", "Jake",  ["Bartender", "Host"],      {"Bartender": 7, "Host": 7}),
            ],
            "coverage_windows": sum(([
                cov(f"chef-d{d}",    "Head Chef",  (MON+d)%7, 10, 18),
                cov(f"line-d{d}",    "Line Cook",  (MON+d)%7, 10, 18),
                cov(f"wait-am-d{d}", "Waiter",     (MON+d)%7, 10, 15, min_w=2),
                cov(f"wait-pm-d{d}", "Waiter",     (MON+d)%7, 15, 22, min_w=2),
                cov(f"bar-d{d}",     "Bartender",  (MON+d)%7, 17, 23),
                cov(f"host-d{d}",    "Host",       (MON+d)%7, 10, 22),
            ] for d in range(5)), []),
            "unavailability":
                [unavail_time("w1", (MON+d)%7, 15, 24) for d in range(5)] +
                [unavail_day("w3", MON)] +
                [unavail_time("w3", (MON+d)%7, 0, 14) for d in range(1, 5)] +
                [unavail_day("w5", (MON+4)%7)] +
                [unavail_time("w6", (MON+d)%7, 0, 16) for d in range(5)] +
                [unavail_day("w7", (MON+1)%7)] +
                [unavail_time("w8", (MON+d)%7, 14, 24) for d in range(5)] +
                [unavail_time("w9", (MON+3)%7, 0, 14)] +
                [unavail_day("w10", MON), unavail_day("w10", (MON+4)%7)],
            "balance_hours": True,
            "settings": DEFAULT_SETTINGS,
        },
    }


ALL_SCENARIOS = [
    s01, s02, s03, s04, s05, s06, s07, s08, s09, s10,
    s11, s12, s13, s14, s15, s16, s17, s18, s19, s20,
]
