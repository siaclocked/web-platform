# Ziedonis Cafe — 2-Week Scenario

**Horizon:** Mon 2026-04-27 → Sun 2026-05-10 (14 days)
**Source:** `Ziedonis Employes 24.04.pdf` (Part 1 + Part 2 of the Café Schedule Builder form) plus a follow-up message listing employee unavailability.

This folder packages the data into a solver request so we can run the scheduler and produce a report. Before running the solver, please review the **Assumptions** section below — that's where we filled gaps in the raw input.

---

## Data faithfully copied from the PDF

### Opening hours

| Day       | Opens | Closes | Notes      |
| --------- | ----- | ------ | ---------- |
| Monday    | —     | —      | **Closed** |
| Tuesday   | 15:00 | 22:00  |            |
| Wednesday | 15:00 | 22:00  |            |
| Thursday  | 15:00 | 22:00  |            |
| Friday    | 15:00 | 23:00  |            |
| Saturday  | 13:00 | 22:00  |            |
| Sunday    | 13:00 | 22:00  |            |

### Staff needed per day

| Day     | Quiet | Peak |
| ------- | ----- | ---- |
| Tue–Sun | 2     | 3    |
| Monday  | —     | —    |

### Position arrival times

- **Head Bartender** — must arrive by **14:30** (13:00 on weekends).
- **Waiters** — 15:00 (13:00 on weekends).
- **Bartender** — 15:00 (13:00 on weekends).

### Employees

| #   | Name   | Role           | Contract  | Skill  | Level | Probation | Works Alone?  | Notes                                                                    |
| --- | ------ | -------------- | --------- | ------ | ----- | --------- | ------------- | ------------------------------------------------------------------------ |
| 1   | Robijs | head bartender | Full-time | Bar    | 10    | No        | Yes           | "Nedēļas pirmajā daļā atleast viena maiņa lai izietu cauri pasūtījumiem" |
| 2   | Diāna  | bartender      | Full-time | Bar    | 10    | No        | Yes           | —                                                                        |
| 3   | Dana   | waitress       | Full-time | Waiter | 8     | **Yes**   | Needs support | —                                                                        |
| 4   | Estere | waitress       | Full-time | Waiter | 8     | **Yes**   | Yes           | "Uni grafiks mainīgs"                                                    |
| 5   | Marta  | waitress       | Full-time | Waiter | 9     | No        | Yes           | "Uni grafiks mainīgs"                                                    |

### Unavailability (verbatim from the client message)

**Bar**

- **Robijs:** 08.05, 09.05
- **Diāna:** 01.05, 03.05, 06.05 — _preference:_ "Gribētu strādāt 02.05"

**Waiter**

- **Dana:** 27.04 (16:00–23:00), 03.05 (19:00–23:00), 10.05 (19:00–23:00)
- **Estere:** 27.04 (9:00–17:00), 28.04, 29.04, 30.04 (9:00–19:00), 05.05 (9:00–14:00), 06.05, 08.05, 09.05
- **Marta:** 27.04 (8:00–15:00), 28.04 (11:00–15:00), 29.04 (11:00–15:00), 30.04 (11:00–15:00), 05.05 (11:00–13:00), 06.05 (11:00–15:00), 07.05 (11:00–15:00), 08.05, 09.05

---

## Assumptions filling gaps in the source data

The PDF form has several fields that were not filled, and some coverage rules that aren't explicit. Here's what we assumed and why. **Please flag anything you want changed before we run the solver.**

### A1. Peak hours boundaries — **confirmed 18:00–21:00**

Client confirmed peak = **18:00–21:00** every open day. Coverage is encoded as three stacked windows per open day:

1. `Bar` for the whole open span (includes 14:30 pre-open on weekdays).
2. `Waiter quiet` for the whole open span — min 1.
3. `Waiter peak` 18:00–21:00 — additional min 1 (total 2 waiters 18–21).

### A2. Can Open / Can Close (NOT filled in PDF)

The radio buttons on the form were blank for all five employees. We inferred defaults from role + probation + rating:

| Worker | can_open | can_close | Reasoning                                                             |
| ------ | -------- | --------- | --------------------------------------------------------------------- |
| Robijs | ✓        | ✓         | Head bartender, Expert 10, full-time, works alone.                    |
| Diāna  | ✓        | ✓         | Bartender, Expert 10, full-time, works alone.                         |
| Dana   | ✗        | ✗         | On probation **and** flagged "Needs Support" — avoid lone open/close. |
| Estere | ✓        | ✓         | On probation but "Works Well Without Supervision".                    |
| Marta  | ✓        | ✓         | Expert 9, no probation, works alone.                                  |

### A3. Head bartender 14:30 weekday start

Treated as a **hard** coverage requirement: weekday `Bar` window is 14:30–22:00 (Tue-Thu) / 14:30–23:00 (Fri). This means one of the bartenders is scheduled for the 30-minute pre-open prep.

The solver cannot distinguish "head" vs "regular" bartender (both map to the same `Bar` skill), so either Robijs or Diana can fill this slot. Practically, with only two bartenders on staff, one of them is on the whole day anyway.

### A4. Contract hour targets (NOT in PDF)

Everyone is Full-time but the PDF gives no hour quotas. The horizon is 2 weeks with limited total demand (≈ 235 staff-hours across 5 workers ≈ 47h/person). We set soft targets that nudge the solver to spread hours fairly:

| Worker | Period min | Period optimal |
| ------ | ---------- | -------------- |
| Robijs | 40 h       | 55 h           |
| Diāna  | 40 h       | 55 h           |
| Dana   | 30 h       | 45 h           |
| Estere | 20 h       | 35 h           |
| Marta  | 30 h       | 45 h           |

Estere's numbers are deliberately lower because she's unavailable 6 of the 12 open days.

### A5. Shift length bounds

Not specified in the PDF. We chose:

- **Hard:** 3h – 10h per shift.
- **Preferred:** 4h – 9h per shift (a full Sat/Sun open window is 9h, so one person can cover a weekend day in one shift).
- **Max hours/day:** 10.
- **Min rest between shifts:** 10h.
- **Granularity:** 30 min.

### A6. Soft-preference handling — what we encoded

- **Robijs** — "Nedēļas pirmajā daļā atleast viena maiņa lai izietu cauri pasūtījumiem".
  → **Encoded** as two **locked** `existing_assignments`: Robijs on Bar **14:30–22:00 on Tue 28.04** and **Tue 05.05**. Tuesday is the first open day of each week (Monday is closed).
  → Cost: ~15h of Robijs's ~55h optimal is pre-committed.

- **Diāna** — "Gribētu strādāt 02.05".
  → **Encoded** as a locked `existing_assignment`: Diana on Bar **13:00–22:00 on Sat 02.05**.
  → Since Diana is off 01.05 and 03.05, Saturday was the likely natural pick anyway — this just locks it in.

- **Dana** — "Needs Support" (probation). Ideally always paired with a senior waiter during her shift.
  → **Handled as a soft rule (client's choice).** Mitigation in-scenario: `can_open = can_close = false` keeps Dana off the opening and closing slots so she is never the lone first-in / last-out. The solver has no explicit "pair with senior" constraint, so she _could_ still be the lone mid-shift waiter during a quiet hour. If the generated schedule shows that happening, we can revisit (add a real constraint or restrict her availability).

### A7. Upcoming events

The PDF lists one event (23/04/2026, +3 staff). It falls **outside** our 27.04–10.05 horizon, so it is ignored.

### A8. Monday 27.04 unavailabilities (retained but inert)

Dana / Estere / Marta all list time-ranges on 27.04, but 27.04 is Monday and the cafe is closed. We kept the entries in the payload for data-fidelity; the solver treats them as no-ops because no coverage exists that day.

---

## Feasibility quick-check

With these assumptions:

- **Bar (Robijs + Diāna):** 12 open days × 1 bartender/day = 12 bar shifts.
  - Diana off 3 days (01/03/06.05); Robijs off 2 days (08/09.05).
  - Every day has at least one of them available → feasible without gaps.
- **Waiter (Dana + Estere + Marta):** 12 open days × ~10 hrs of stacked waiter demand (7-8h quiet baseline + 3h peak add-on).
  - Heaviest stress points:
    - **Thu 30.04:** Estere 19–22 only, Marta fully available, Dana fully available → covers.
    - **Wed 06.05:** Estere off → Dana + Marta.
    - **Fri 08.05 & Sat 09.05:** Estere + Marta off → Dana is the ONLY waiter available. Peak 18–21 requires 2 waiters → **expected coverage gap 18:00–21:00 on both days unless extra help is found**.

→ The report will highlight 08.05 & 09.05 as understaffed days (client accepted this — the report will surface the message).

---

## Files

- `scenario.py` — data & `build_scenario()` returning a `SolveRequest` payload.
- `README.md` — this document.
- `__init__.py` — package marker.

Next step after the assumptions are approved: add `run_test.py` (copy the may_cafe pattern) and generate the HTML report.
