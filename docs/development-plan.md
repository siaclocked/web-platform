# Clocked — Development Plan & Checklist

**Document status:** Active  
**Last updated:** 2026-02-17  
**Reference:** [requirements.md](./requirements.md)  
**Methodology:** Kanban (Backlog → In Progress → Review → Done)

---

## How to read this document

- Phases are ordered by priority: **Phase 1 is the core MVP** (shift scheduler).
- Each phase builds on the previous one.
- Checkboxes track completion. Mark `[x]` when done.
- `§` references point to sections in `requirements.md`.

---

## Phase 1 — Core Shift Scheduler (MVP Priority)

> **Goal:** A working shift scheduling system where managers create places, register workers with skills, define coverage needs, workers submit availability, the solver generates schedules, and managers publish them. This is the primary problem we are solving.

### 1.1 Auth & User Management

- [X] Company Admin can create a company + first Manager account (§3.1)
- [] Manager login with email + password
- [x] Worker login with email OTP (§10.1)
- [ ] Rate limiting and OTP TTL enforcement
- [ ] User profile page — worker can view/edit limited personal details (§10.9)
- [ ] RLS policies enforce company isolation on all tables (§15.1)

### 1.2 Place Setup (Manager)

- [x] CRUD places (name, address) (§7.1)
- [ ] Place scheduling settings: granularity, min/max hours per day, block limits, rest between shifts (§7.5)
- [x] Global skills catalog — Manager can create/edit skill names (§7.2)
- [ ] Place skills config — enable skills per place, optional `minAvgRating` threshold (§7.3)

### 1.3 Worker Management (Manager)

- [ ] CRUD workers: name, email, status (INVITED/ACTIVE/DISABLED) (§7.6)
- [x] Assign workers to places (place scope: ALL or selected) (§7.6)
- [ ] Assign skills to workers with rating per skill (§7.6)
- [x] Set worker hourly rate (§7.6)
- [ ] Set worker start date (solver eligibility) (§7.6)

### 1.4 Coverage Templates (Manager)

- [ ] Weekly coverage template per place + skill (§7.4)
- [ ] Define: dayOfWeek, startTime, endTime, minCount, maxCount
- [ ] Multiple windows per day per skill supported
- [ ] No overlap validation within same skill/day/place

### 1.5 Availability Submission (Worker)

- [ ] Worker submits availability: full-day, time-range, or vacation flag (§10.5)
- [ ] Availability restricted to published schedule horizon only (§10.5)
- [ ] Calendar UI for selecting dates and time ranges

### 1.6 Schedule Generation (Solver Integration)

- [ ] Manager selects date range and triggers "Generate Schedule" (§8.1)
- [ ] Backend builds solver request from: workers, skills, coverage templates, availability, place settings
- [ ] Call Python CP-SAT solver service `/solve` endpoint (§5.2)
- [ ] Receive assignments + diagnostics (coverage gaps, constraint violations)
- [ ] Store result as DRAFT schedule
- [ ] Display draft to Manager in day/week view

### 1.6a Solver v2 — Flexible Shift Model (§9.3)

> **Must land before any schedule generation UI is shipped.** This replaces the v1 atomic-window assignment model.

**Core model rewrite (`solver/main.py` — `_solve_cpsat` and `_solve_greedy`):**

- [ ] Convert coverage windows to slot-demand map: `required_workers[day, skill, slot]` using `granularity_minutes`
- [ ] Generate candidate shifts per `(worker, day, skill)`: all `(start, end)` pairs where `minShiftMinutes ≤ end−start ≤ maxShiftMinutes`, start/end snap to granularity, and interval fits worker availability
- [ ] Decision variable `x[worker, day, skill, start, end]` ∈ {0,1}
- [ ] Hard constraint: for each slot, `sum(covering shifts)` + slack ≥ `required_workers[slot]`
- [ ] Hard constraint: `sum(x for worker on day across all skills)` ≤ 1 (one shift per day)
- [ ] Hard constraint: shift must not overlap worker unavailability
- [ ] Hard constraint: locked existing assignments fixed to their exact `(start, end)`

**Objective (priority order):**

- [ ] P1: Minimize coverage gap penalty — weight 1000 per uncovered slot-worker unit
- [ ] P2: Balance hours proportional to availability — compute each worker's available minutes in horizon; target share = `available_i / sum(available_all)`; penalize deviation from target (weight 50)
- [ ] P3: Prefer longer shifts — penalize `(maxShiftMinutes − actual_shift_minutes)` per assignment (weight 1)
- [ ] P4: Minimize changes vs existing assignments during repair (weight 5 per removed assignment)

**Greedy fallback update:**

- [ ] Greedy: for each worker/day/skill, pick the longest valid shift (respecting min/max) that covers the most uncovered demand slots; track slot coverage and skip already-filled slots

**API contract (no breaking changes):**

- [ ] Rename `min_hours_per_block` → `min_shift_minutes` and `max_hours_per_block` → `max_shift_minutes` in `PlaceSettings` (keep old names as aliases for backwards compat)
- [ ] `Assignment` response already carries free `start_minutes`/`end_minutes` — no schema change needed
- [ ] Update `process-deadline/route.ts` to pass `min_shift_minutes` / `max_shift_minutes` from place settings

**Regression tests (`solver/test_solver.py` — new tests):**

- [ ] T-F1: Cross-window shift — single shift 10:00–18:00 correctly satisfies 08:00–13:00 and 13:00–18:00 demand windows
- [ ] T-F2: Partial availability handoff — worker A available 09:00–13:30, worker B 13:30–16:00; solver assigns two shifts covering a 09:00–16:00 window
- [ ] T-F3: Min-length fallback — 4-worker day with only 2h of demand left; solver assigns a `minShiftMinutes` shift rather than leaving a gap
- [ ] T-F4: Long-shift preference — when two plans are equally valid, solver prefers the one with longer shifts
- [ ] T-F5: Max-1-shift-per-day preserved — worker with availability across 3 coverage windows gets exactly 1 shift

### 1.7 Schedule Publish & History

- [ ] Manager can publish a draft schedule (§8.3)
- [ ] Publishing overwrites PUBLISHED assignments only within draft interval
- [ ] Each publish creates an immutable history record (§4.5)
- [ ] Workers see only PUBLISHED schedules (§4.5)

### 1.8 Worker Dashboard

- [ ] Worker home shows **next upcoming shift** prominently (place, skill, date, time) (§10.2)
- [ ] Below: **handoff notes** from previous shift at that place/skill (§10.2)
- [ ] Quick-access menu to other features

### 1.9 Schedule Views

- [ ] Manager: month view calendar showing scheduled days (§ wireframes)
- [ ] Manager: week view — columns = days, rows = worker shift cards
- [ ] Manager: day view — Gantt-chart: roles on Y-axis, time on X-axis, worker bars (§ wireframes)
- [ ] Worker: planning calendar — month view, tap day to see blocks + coworkers (§10.4)

### 1.10 Notifications (In-App — MVP)

- [ ] Notification storage with read/unread (§12.4)
- [ ] SCHEDULE_CHANGED_FOR_WORKER — only impacted workers notified (§12.3)
- [ ] Worker can view notifications and mark as read (§10.3)
- [ ] Unread badge in navigation

---

## Phase 2 — Time Tracking & Hours

> **Goal:** Workers can clock in/out, managers can see who's working, and both can view hours.

### 2.1 Time Tracking (Worker)

- [ ] Start/stop work session (§10.6)
- [ ] If near planned block (grace period), auto-attach to that shift
- [ ] Otherwise: choose place + skill (marked "unscheduled")
- [ ] Session stored with start_time, end_time (null while active)

### 2.2 Currently Working (Manager)

- [ ] Live "Who is Working" view based on active sessions (§11.1)
- [ ] Safeguards for stuck sessions (sessions without end_time beyond threshold)

### 2.3 My Hours + Salary Preview (Worker)

- [ ] Worker views: total worked hours this month, approved vs pending (§10.10)
- [ ] Salary estimate: hourly rate × approved hours (simple model)

---

## Phase 3 — Shift Handoff & Checklists

> **Goal:** Enable shift-to-shift communication and task tracking.

### 3.1 Shift Handoff Notes

- [ ] On session stop, worker can leave a handoff note (§10.8)
- [ ] Audience selection: NEXT_IN_SKILL or NEXT_SHIFT_ALL
- [ ] Recipients receive HANDOFF_NOTE_RECEIVED notification (§12.2)

### 3.2 Checklist

- [ ] Manager configures checklist templates per place + skill (§10.7)
- [ ] Each work session gets its own checklist instance
- [ ] Worker can check off items during session
- [ ] Checklist resets each new session

---

## Phase 4 — Open Shifts

> **Goal:** Surface unfilled coverage gaps and let workers volunteer.

- [ ] Open shifts derived from coverage gaps after schedule generation (§13.1)
- [ ] Worker sees eligible open shifts (matching place + skill + no conflicts) (§13.2)
- [ ] Worker can express interest ("I'm available")
- [ ] Manager reviews interests and approves up to missingCount (§13.3)
- [ ] Approval revalidates schedule constraints
- [ ] Notifications: OPEN_SHIFT_AVAILABLE, OPEN_SHIFT_INTEREST_SUBMITTED (§12.2)

---

## Phase 5 — Timesheets & Payroll Export

> **Goal:** Manager reviews, edits, approves worked hours and exports for payroll.

### 5.1 Timesheet Review

- [ ] Manager views timesheets per worker per month (§11.2)
- [ ] Manager can edit session times with required reason + audit trail
- [ ] Approve a month → locks the period
- [ ] Notifications: TIMESHEET_APPROVED, TIMESHEET_EDITED_BY_MANAGER (§12.2)

### 5.2 Export (Core Feature)

- [ ] Manager selects workers via checkbox list + date range (start date, end date) (§11.2)
- [ ] Download CSV with columns: `Name Surname`, `Hours during <start date> – <end date>`
- [ ] One row per selected worker; hours = sum of approved work session durations in period
- [ ] Monthly salary summary view (total payroll, avg rate, total hours)

---

## Phase 6 — Leave / Vacation Management

> **Goal:** Workers request leave, managers approve, balance is tracked with automatic accrual.

### 6.1 Leave Requests

- [ ] Worker submits leave request: date range, leave type, comment
- [ ] Manager views pending/approved/rejected leave requests (§11.4)
- [ ] Manager approves or rejects with reason
- [ ] Approved leave creates unavailability entries for the solver
- [ ] Forward approved leave summaries to accountant (simple export or email — exact workflow TBD) (§11.4)

### 6.2 Vacation Accrual

- [ ] Manager sets global accrual rate X in company settings ("1 vacation day per X worked hours") (§4.7)
- [ ] System automatically calculates accrued vacation days from approved work sessions
- [ ] Worker can view: total accrued days, used days, remaining balance (§4.7)
- [ ] Vacation balance shown in worker profile / leave request screen

---

## Phase 7 — Schedule Overrides & Repair

> **Goal:** Manager can manually adjust schedules and the system revalidates.

- [ ] Manual assign/unassign worker to a block (§8.4)
- [ ] Lock/unlock assignments (locked = solver must keep) (§8.4)
- [ ] Draft revalidation after any override (§8.5)
- [ ] If invalid: draft status = INVALID, publish disabled, diagnostics shown
- [ ] Repair / minimal-change regeneration (§8.6)
- [ ] Draft overlay: toggle between Published and Draft, diff summary (§8.2)

---

## Phase 8 — Documents

> **Goal:** Centralized document storage for worker and company files.  
> **Note:** On hold per requirements.md §2.2 due to legal liability concerns. Implement when cleared.

### 8.1 Manager Document Management

- [ ] Manager uploads/replaces/archives documents for individual workers (e.g., employment contracts) (§11.3)
- [ ] Manager uploads team-wide or company-wide documents (exact scope TBD by product) (§11.3)
- [ ] DOCUMENT_UPLOADED notification (§12.2)

### 8.2 Worker Document Access

- [ ] Worker views document list (manager-uploaded + self-uploaded) + downloads via signed URLs (§10.11)
- [ ] Worker can view employment contract and other manager-assigned documents (§10.11)
- [ ] Worker can upload personal documents (certificates, ID copies, medical records) (§10.11)

### 8.3 Document Lifecycle

- [ ] Document scopes: worker-specific (manager-uploaded), worker-specific (self-uploaded), team/company-wide (§14.2)
- [ ] Document states: ACTIVE / REPLACED / ARCHIVED / EXPIRED (§14.3)
- [ ] Expiration evaluated on-read (no scheduled job) (§14.3)

---

## Phase 9 — Settings & Admin

> **Goal:** Company settings, place management across managers, billing.

### 9.1 Company Settings

- [ ] View/edit company info: name, registration number, address, email, phone, logo
- [ ] Set global vacation accrual rate (hours per vacation day) — shared config for Phase 6

### 9.2 Place Reassignment (Company Admin)

- [ ] Company Admin can view all places across all managers (§3.2)
- [ ] Company Admin can reassign a place from one manager to another (§3.1)

### 9.3 Billing & Subscription (§16)

> **Note:** Not needed for early clients (manual billing). Implement when scaling.

- [ ] Integrate Stripe (Checkout + Customer Portal + Webhooks) (§16.1)
- [ ] Multiple subscription tiers (Starter, Professional, Enterprise) (§16.1)
- [ ] Custom tier: form for company size, managers, worker count → tailored quote (§16.1)
- [ ] Manager/Admin view: current tier, billing cycle, invoice history (§16.2)
- [ ] Upgrade / downgrade tier (§16.2)
- [ ] Contact support / request custom plan (§16.2)
- [ ] Stripe webhooks activate/deactivate company subscription status (§16.3)
- [ ] Deactivation → company enters read-only mode (§16.3)

---

## Phase 10 — PWA Polish & Production Readiness

> **Goal:** Production-ready PWA with full offline support and installability.

- [ ] Service worker for offline caching of schedule views
- [ ] App manifest with icons (iOS + Android already in `/public/icons/`)
- [ ] Install prompt / Add to Home Screen
- [ ] Responsive design verified on mobile, tablet, desktop
- [ ] Performance optimization (lazy loading, code splitting)
- [ ] Error boundaries and user-friendly error states
- [ ] Supabase RLS audit — verify all policies
- [ ] Security review (no leaked keys, rate limiting, input validation)

---

## Phase 11 — Native Mobile App (React Native + Expo)

> **Goal:** Build a native mobile app for the **Worker role** using React Native and Expo, referencing the fully built Next.js project.  
> **Timing:** After PWA is stable with paying clients or budget.

### 11.1 Setup

- [ ] Initialize Expo project with TypeScript
- [ ] Configure Supabase SDK (same backend, no separate API needed)
- [ ] Auth flow: Email OTP login (reuse Supabase auth)

### 11.2 Core Worker Features (port from PWA)

- [ ] Planning calendar (schedule view)
- [ ] Availability submission
- [ ] Time tracking (start/stop)
- [ ] Shift handoff notes
- [ ] Checklist during shift
- [ ] My Hours + salary preview
- [ ] Notifications (in-app + push via Expo Notifications)
- [ ] Open shifts — view + express interest
- [ ] Profile view/edit
- [ ] Documents download

### 11.3 Native Enhancements

- [ ] Push notifications via Expo Push / APNs + FCM
- [ ] Background location for geofenced clock-in (if enabled)
- [ ] Biometric authentication (optional, as secondary auth)

### 11.4 App Store Deployment

- [ ] Apple Developer Program ($99/year)
- [ ] Google Play Developer ($25 one-time)
- [ ] App Store review compliance (privacy policy, data handling)
- [ ] TestFlight / Internal testing track setup

---

## Appendix: Dead Code Cleanup

The following legacy items should be cleaned up (see migration `018_cleanup_dead_tables.sql`):

**Tables dropped:**

- `positions` (replaced by `skills`)
- `shift_timeframes`, `shift_slots`, `worker_shift_assignments` (replaced by `schedule_templates` flow)
- `shift_interests` (unused)
- `timesheets`, `timesheet_edits` (unused — hours tracked via `work_sessions`)
- `documents` (feature on hold)

**Dead columns removed:**

- `users.position_id`

**Legacy API routes to remove:**

- `app/api/schedules/solve/route.ts` — uses dead `schedules`/`shifts` tables
- `app/api/schedules/publish/route.ts` — uses dead `schedules`/`shifts`/`schedule_history` tables
- `app/api/timesheets/route.ts` — uses dead `timesheets` table

**Active scheduling flow:**

- `schedule_templates` → `shift_templates` → `worker_availability_submissions` → solver → publish
