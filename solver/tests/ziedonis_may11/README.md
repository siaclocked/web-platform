# Ziedonis Cafe — May 11–24, 2026

Second scheduling window. Run with the solver listening on `localhost:8000`:

```bash
python3 tests/ziedonis_may11/run_test.py
```

Output: `ziedonis_report.html` in this folder.

## What's different vs the April run

| Change | Before (April) | Now (May 11) |
|---|---|---|
| Staff | 5 | **6** — Madara Garance joins the Bar team |
| Monday | **closed** | open |
| Weekday open hours | Tue–Thu 15:00–22:00 | **Mon–Thu 13:00–23:00** |
| Weekend open hours | Fri 15:00–23:00, Sat/Sun 13:00–22:00 | **Fri–Sun 11:00–23:00** |
| Peak waiter | 18:00–21:00 (3h helper) | **18:00–23:00 (closer, handoff)** — opener leaves at 21:00 |
| `can_open / can_close` | role-dependent | **everyone true** |
| Diāna | working normally | **vacation Thu 14 → Sun 17** |

## Pinned bar shifts (client-dictated)

| Day | Worker | Shift | Notes |
|---|---|---|---|
| Mon 11 | Diāna | 13:00–23:00 | pre-vacation lock |
| Tue 12 | Diāna | 13:00–23:00 | pre-vacation lock |
| Wed 13 | Diāna | 13:00–23:00 | pre-vacation lock |
| Thu 14 | Madara | 13:00–21:00 | opener (vacation-week handoff) |
| Thu 14 | Robijs | 18:00–23:00 | closer (joins at peak) |
| Fri 15 | Madara | 11:00–21:00 | opener |
| Fri 15 | Robijs | 18:00–23:00 | closer |
| Sat 16 | Robijs | 11:00–23:00 | only eligible bartender |
| Sun 17 | Robijs | 11:00–23:00 | only eligible bartender |
| Mon 18 | Madara | 13:00–23:00 | quieter post-vacation day |
| Tue 19 | Madara | 13:00–23:00 | quieter post-vacation day |

Everything else (Wed 20, Thu 21, Fri 22, Sat 23, Sun 24 bar, and all waiter shifts) is left to the solver.

## Availability grid convention

The Clocked app grid shows time-range cells like "17:00–23:00 ×" on a worker's
row. We interpret these as **"available only within that window"** (option A in
the session notes) and translate them to complementary unavailability ranges.

Where the available window overlaps the cafe's open hours for less than the
3h minimum shift, we treat the day as a full-day off. Those cases are called
out inline in `_build_unavailability()`.

## Coverage shape

- **Mon, Tue, Wed**: 1 bar (13:00–23:00) + 1 waiter. Waiter coverage is
  technically split at 18:00 into two non-overlapping windows so the solver
  can hand off between two workers when nobody has full-day availability
  (e.g. Mon 11). This does **not** demand a second worker.
- **Thu**: 1 bar (13:00–23:00) + 1 waiter opener (13:00–21:00) + 1 waiter
  closer (18:00–23:00). During 18:00–21:00 two waiters overlap.
- **Fri / Sat / Sun**: 1 bar (11:00–23:00) + same waiter handoff as Thu.
- **Thu 14 & Fri 15 only**: bar coverage ALSO splits into opener + closer to
  accept the Madara-opens / Robijs-closes handoff dictated by the client.

## Settings

- `max_shift_minutes = 720` (12h) — needed so a single bartender can cover
  Sat/Sun 11:00–23:00 during Diāna's vacation.
- `soft_max_shift_minutes = 540` (9h) — solver still prefers shorter shifts
  when it has a choice.
