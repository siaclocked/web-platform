# Clocked — Development Plan & Checklist

**Document status:** Active  
**Last updated:** 2026-02-16  
**Reference:** [requirements.md](./requirements.md)

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

- [ ] Company Admin can create a company + first Manager account (§3.1)
- [ ] Manager login with email + password
- [ ] Worker login with email OTP (§10.1)
- [ ] Rate limiting and OTP TTL enforcement
- [ ] User profile page — worker can view/edit limited personal details (§10.9)
- [ ] RLS policies enforce company isolation on all tables (§15.1)

### 1.2 Place Setup (Manager)

- [ ] CRUD places (name, address) (§7.1)
- [ ] Place scheduling settings: granularity, min/max hours per day, block limits, rest between shifts (§7.5)
- [ ] Global skills catalog — Manager can create/edit skill names (§7.2)
- [ ] Place skills config — enable skills per place, optional `minAvgRating` threshold (§7.3)

### 1.3 Worker Management (Manager)

- [ ] CRUD workers: name, email, status (INVITED/ACTIVE/DISABLED) (§7.6)
- [ ] Assign workers to places (place scope: ALL or selected) (§7.6)
- [ ] Assign skills to workers with rating per skill (§7.6)
- [ ] Set worker hourly rate (§7.6)
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

### 1.7 Schedule Publish & History

- [ ] Manager can publish a draft schedule (§8.3)
- [ ] Publishing overwrites PUBLISHED assignments only within draft interval
- [ ] Each publish creates an immutable history record (§4.5)
- [ ] Workers see only PUBLISHED schedules (§4.5)

### 1.8 Schedule Views

- [ ] Manager: month view calendar showing scheduled days (§ wireframes)
- [ ] Manager: week view — columns = days, rows = worker shift cards
- [ ] Manager: day view — Gantt-chart: roles on Y-axis, time on X-axis, worker bars (§ wireframes)
- [ ] Worker: planning calendar — month view, tap day to see blocks + coworkers (§10.4)

### 1.9 Notifications (In-App — MVP)

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

### 5.2 Export

- [ ] Export CSV per worker and/or place summary (§11.2)
- [ ] Monthly salary summary view (total payroll, avg rate, total hours — per wireframes)

---

## Phase 6 — Leave / Vacation Management

> **Goal:** Workers request leave, managers approve, balance is tracked.

- [ ] Worker submits leave request: date range, leave type, comment
- [ ] Manager views pending/approved/rejected leave requests
- [ ] Manager approves or rejects with reason
- [ ] Approved leave creates unavailability entries for the solver
- [ ] Leave balance tracking (accrual formula — placeholder, configurable later) (§4.7)

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

> **Goal:** Centralized document storage for worker files.  
> **Note:** On hold per requirements.md §2.2 due to legal liability concerns.

- [ ] Manager uploads/replaces/archives documents for a worker (§11.3)
- [ ] Worker views document list + downloads via signed URLs (§10.11)
- [ ] Document states: ACTIVE / REPLACED / ARCHIVED / EXPIRED (§14.2)
- [ ] Expiration evaluated on-read (no scheduled job) (§14.2)
- [ ] DOCUMENT_UPLOADED notification (§12.2)

---

## Phase 9 — Settings & Admin

> **Goal:** Company settings, billing, multi-manager support.

### 9.1 Company Settings

- [ ] View/edit company info: name, registration number, address, email, phone, logo
- [ ] Venue management (view all places across managers)

### 9.2 Billing & Subscription (from PRD, not in requirements.md)

- [ ] View current subscription tier
- [ ] Upgrade subscription
- [ ] Contact support

### 9.3 Manager Permissions (from PRD, not in requirements.md)

- [ ] Multiple manager roles with configurable permissions
- [ ] Manager can manage other managers' access levels

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
