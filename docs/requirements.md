# Shift Scheduling Platform (PWA) — Master Requirements (MVP)

**Document status:** Draft  
**Language:** English (UI may be bilingual later)  
**Key roles terminology:** Use **Manager** for the manager role.

---

## 0. Document Control

- **Owner:** Product/Engineering
- **Goal:** Single source of truth for building the MVP with Windsurf
- **Change process:** Any change must be reflected in this file; feature decisions should be recorded under “Decisions”.
- **Development methodology:** Kanban (continuous flow with WIP limits). The team is small, features vary in size, and there is no fixed sprint cadence — Kanban fits better than Scrum for this context. Use a board with columns: Backlog → In Progress → Review → Done.

---

## 1. Product Summary

### 1.1 Problem Statement

Current pain points:

1. Schedule creation is slow and inefficient.
2. Manual scheduling is error-prone.
3. Employee documents are not centralized.
4. Worked-hours tracking is inefficient and inaccurate → payroll overpayments.
5. Employees lack transparency on how pay is calculated.
6. Employees lack clarity on vacation/leave requests.
7. Workers have no visibility into their accrued vacation balance.

### 1.2 Expected Improvements

Automation should:

- Generate schedules automatically under hard constraints.
- Track worked hours accurately via time tracking.
- Centralize employee documents.
- Provide transparent hours and pay estimates.
- Simplify vacation/leave processes (MVP: basic).
- Provide transparent vacation balance accrual.

### 1.3 Key Metrics

- Time saved in scheduling (hours/week)
- Reduction in payroll correction incidents
- Reduction in unfilled coverage
- Worker satisfaction (proxy: fewer schedule/pay questions)

---

## 2. Scope

### 2.1 In Scope (MVP)

- Next.js PWA (Worker + Manager UI)
- Supabase: Auth (Email OTP for workers/managers; email+password for company admin), Postgres (data), Storage (documents), Realtime (optional)
- Python CP-SAT solver service (Google OR-Tools) called via internal API
- Place setup (skills per place, weekly coverage templates, scheduling settings)
- Worker CRUD (by Manager), Worker Email OTP login
- Schedule generation for an interval (draft), overlay compare, publish, history
- Manual override with revalidation (locks)
- Availability (full day, time range, vacation flag)
- **Availability submission restricted to published schedule horizon**
- Open shifts from unfilled coverage + worker interest + Manager approval
- Time tracking (start/stop), “currently working”
- Checklist per work session
- Shift handoff notes with audience selection
- Notifications (in-app) + read/unread
- My Hours + salary preview (simple hourly model)
- Timesheet review/edit/approve/export (CSV)
- Documents list + download via signed URLs (expiration evaluated on-read)

### 2.2 On Hold (Deferred from MVP)

The following features are defined in this document but are **on hold** and will not be developed in the current iteration:

- **Documents feature** (§10.11, §11.3, §14) — On hold due to potential legal liability concerns. May be revisited in a future version.
- **Open Shifts** (§13) — Worker interest + Manager approval for unfilled coverage gaps.
- **Draft Overlay / Layer Toggle** (§8.2) — Diff comparison between published and draft schedules.
- **Manual Overrides + Locking** (§8.4) — Assign/unassign with lock/unlock and revalidation.
- **Audit Log** (§15.1) — Detailed audit trail for sensitive actions.

### 2.3 Out of Scope (MVP)

- Native mobile app stores
- Guaranteed background geofencing / always-on lockscreen timer (platform-limited in PWA)
- Complex payroll (overtime, allowances, tax, etc.) beyond hourly
- Recurring availability patterns (e.g., every Monday) — later
- Multi-place assignments within the same day (explicitly forbidden)
- Advanced fairness optimization (placeholder only)

---

## 3. Users, Roles, Permissions

### 3.1 Roles

- **Company Admin (Your team):** Creates company + Manager account(s); can reassign places between managers
- **Manager:** Configures places, skills, workers, schedules, approvals
- **Worker:** Views schedule, sets availability (within published horizon), time tracking, docs, notes, checklist

### 3.2 Permissions (High Level)

- Company Admin: create company, create Manager accounts, reassign places between managers
- Manager:
  - CRUD: Places, Place settings, Place skills config, Coverage templates
  - CRUD: Workers, Worker skills/ratings, Worker place scope, Worker status
  - Generate/publish schedules, view history, revert via draft from history
  - Manual schedule overrides (lock/unlock), repair/regenerate interval
  - Manage open shifts, approve interests
  - View/edit/approve/export timesheets
  - Upload/replace/archive documents
- Worker:
  - Email OTP login
  - View published schedule
  - Submit availability (restricted to published horizon)
  - Start/stop time tracking + checklist + handoff note
  - View hours + pay estimate
  - Download documents
  - Upload personal documents (e.g., certificates, ID copies)
  - View employment contract and other manager-uploaded documents relevant to the worker
  - View/mark notifications read

---

## 4. Glossary and Core Concepts

### 4.1 Skill / Position

Synonyms. Examples: waiter, cook, security. Workers have a **rating per skill**.

### 4.2 Place

A staffing location (e.g., restaurant). A worker is eligible for a place if assigned to it (or “All”).

**Hard rule:** A worker must not have shifts in **two different places on the same day**.

### 4.3 Coverage Window (Darba logs)

A time interval at a place for a specific skill with required headcount:

- minCount ≤ assignedCount ≤ maxCount
- optional minAvgRating threshold (per place+skill, enforced per staffed slot when enabled)

### 4.4 Block (Bloks)

A contiguous interval assigned to a worker at a place in a skill. In the UI, blocks can be shown as “shifts”.

### 4.5 ScheduleVersion

A schedule snapshot for one place and a date interval:

- status: DRAFT or PUBLISHED
- publishing overwrites published assignments **only within the draft interval**
- every publish is stored in history (immutable record)
- workers see only PUBLISHED

### 4.6 Open Shift

Representation of **unfilled coverage** (gaps). Workers can express interest; Manager approves.

### 4.7 Vacation (Paid Leave)

A special unavailability flag (`isPaidLeave=true`) that consumes leave balance.

**Accrual rule:** For every X worked hours, the worker earns 1 vacation day. The Manager sets X globally for all workers in the company dashboard (e.g., X = 160 means 1 vacation day per 160 hours worked). The system tracks the accrued balance automatically based on approved work sessions.

Worker can see:

- total accrued vacation days
- used vacation days
- remaining balance

---

## 5. System Architecture

### 5.1 Components

- **Next.js PWA**
  - UI (Worker + Manager)
  - Backend orchestration (API routes/server actions): validation, calling solver, writing schedules, notifications
- **Supabase**
  - Auth: Email OTP (MVP)
  - Postgres: all domain data with RLS
  - Storage: documents with signed URLs
  - Realtime: optional for live updates
- **Python Solver Service**
  - OR-Tools CP-SAT
  - Endpoints: `/solve` and `/validate`
  - Returns assignments + diagnostics

### 5.2 Scheduler Contract (High-Level)

Inputs:

- place, interval
- coverage windows — each defines **required headcount during a time interval** (staffing demand); they are **not** boundaries constraining individual shift start/end times
- workers (eligibility, start date, skill ratings, total available minutes in horizon)
- workers (`canOpen`, `canClose` flags per worker)
- unavailability (per-day or time-ranged)
- existing assignments (previous schedule for minimal change)
- locked assignments (manual overrides)
- place+skill constraints (`enforceMinTeamRating`, `minAvgRating`)
- place settings: `minShiftMinutes`, `maxShiftMinutes`, max hours/day, min rest between shifts, granularity

Outputs:

- status: OPTIMAL/FEASIBLE/INFEASIBLE
- assignments per worker — each with actual `start_minutes`/`end_minutes`; a single shift may span across multiple coverage windows
- coverage gaps (unmet demand per window+skill, with required vs assigned headcount)
- diagnostics (constraint violations summary)

---

## 6. Data Model (Conceptual)

> All rows must be scoped by `company_id` and protected with Supabase RLS.

### 6.1 Core Entities

- Company
- ManagerUser
- WorkerUser
- Place
- Skill (global catalog per company)
- PlaceSkillConfig (skills enabled per place + thresholds)
- CoverageTemplateWindow (weekly template per place+skill)
- PlaceSettings (granularity, hours, blocks, rest)
- Unavailability (incl. vacation flag)
- ScheduleVersion (draft/published/history)
- Assignment (block assignment; can be locked; source solver/manual)
- OpenShift + OpenShiftInterest
- WorkSession (time tracking)
- ChecklistTemplate + ChecklistInstance
- HandoffNote
- Document (files) + access logs (optional)
- Notification
- TimesheetApproval
- WorkerCompensation (hourly rate)

---

## 7. Manager Setup Flows

### 7.1 Create Place

Fields:

- name
- timezone
- optional address + GPS coordinates (for start/stop location validation)

### 7.2 Global Skills Catalog (Company-level)

Manager can create/edit skills (names).

### 7.3 Place Skills Config (per Place)

Manager selects enabled skills for the place and configures per-skill thresholds:

- `enforceMinTeamRating` (boolean, default false)
- `minAvgRating` (nullable, required when enforcement is enabled)

### 7.4 Weekly Coverage Template (per Place + Skill)

Manager defines weekly windows per skill:

- dayOfWeek, startTime, endTime, minCount
- multiple windows/day supported (chunks)
- MVP: no overlap within the same skill/day for a place
- `maxCount` is deferred in the current solver contract and is not enforced by the MVP solver

> **Important:** Coverage windows define **required headcount** during that interval — they are staffing demand requirements, not shift boundaries. A worker's shift may start before a window, end after, or span across multiple adjacent windows. The solver determines actual shift start/end times freely within worker availability and place settings.

### 7.5 Place Scheduling Settings

Per place:

- `timeGranularityMinutes` (15/30/60) — resolution for shift start/end snapping
- `maxHoursPerDay`
- optional `minHoursPerDay`, `minHoursPerWeek`, `maxHoursPerWeek` are deferred in the current solver contract
- `minShiftMinutes` — minimum shift length (hard constraint). Solver never schedules a shift shorter than this. Example: 120 min (2 h). Short shifts near this value are discouraged by the soft objective and only appear when understaffing forces it.
- `maxShiftMinutes` — maximum shift length (hard upper bound + soft target). Solver prefers shifts close to this value. Example: 480 min (8 h).
- `minRestMinutesBetweenShifts` — minimum rest between a worker's shifts across consecutive days

### 7.6 Worker Management (CRUD)

Create/edit:

- name, email (unique)
- status (INVITED/ACTIVE/DISABLED)
- place scope: ALL or selected places
- start date (solver eligibility begins on/after this date)
- skills + rating per skill (scale defined by company; e.g., 1–10)
- `canOpen` (boolean): eligible to be among earliest starters on a day
- `canClose` (boolean): eligible to be among latest finishers on a day
- hourly rate (for pay estimate)
- optional `monthlyMinHours` and `monthlyOptimalHours` — worker-level monthly hour targets used as soft scheduling targets

---

## 8. Scheduling: Generation, Drafts, Publish, History, Overrides, Repair

### 8.1 Generate Schedule for Interval

- Manager selects `from` and `to` and clicks **Generate/Schedule**
- Plan limit: `to` must be within `MAX_FUTURE_DAYS` (e.g., 14 or 30) from "today" (place timezone)

**Draft creation/update rule:**

- If currently viewing PUBLISHED: Generate creates a **new DRAFT** for that interval
- If currently viewing DRAFT: Generate updates the **existing draft** (same draft id)

### 8.2 Draft Overlay (Layer Toggle)

- UI can toggle between Published and Draft
- Diff summary recommended: added/removed/changed assignments

### 8.3 Publish

Publishing a draft:

- overwrites PUBLISHED assignments only within draft interval
- stores a history record
- workers see only the resulting PUBLISHED schedule

### 8.4 Manual Overrides (Assign/Unassign) + Locking

Manager can:

- assign worker to a window/block (creates locked assignment by default)
- unassign worker (creates open coverage)
- lock/unlock assignments (locked = solver must keep)

After any override, draft must be revalidated.

### 8.5 Revalidation Rules (Hard)

- Coverage minimum per window+skill
- Avg rating threshold per place+skill per staffed slot (if enabled)
- Worker availability
- No overlap
- One place per day per worker
- Hours/day limits
- Block duration limits
- Min rest between blocks
- `maxCount` coverage and optional day/week minimum-hour settings are deferred and do not participate in current draft validation

If invalid:

- draft status = INVALID
- Publish disabled
- show diagnostics; allow “Repair interval”

### 8.6 Repair / Minimal Change

When repairing (due to availability change or manager action):

- previous baseline = current published (or current draft if in draft mode)
- objective order: minimize coverage gaps first, then minimize changes, then apply other soft preferences
- locked overrides are treated as hard constraints

### 8.7 Infeasible Handling

If solver returns INFEASIBLE:

- draft marked INVALID
- show “Unfilled Coverage Report” with day/time/skill/missing count
- Manager actions: adjust coverage, adjust thresholds, add workers, relax constraints, regenerate

---

## 9. Constraints (Hard vs Soft)

### 9.1 Hard Constraints (must always hold)

- Coverage: min ≤ assignedCount for every place+window+skill (`maxCount` is deferred in the current solver contract)
- Eligibility: worker has skill rating, is assigned to place (or ALL), startDate reached
- Availability: shift must fall entirely within worker's available window(s) for that day
- One shift per day: max one shift per worker per day (shift may span multiple coverage windows)
- One place per day: worker cannot be scheduled at 2 places on the same day
- Shift duration: each shift must be ≥ `minShiftMinutes` and ≤ `maxShiftMinutes`
- Hours: total assigned hours within configured max per day
- Rest: min rest between a worker's shifts on consecutive days (`minRestMinutesBetweenShifts`)
- Opening eligibility: if a day has assignments, earliest starter group must include at least one worker with `canOpen=true`
- Closing eligibility: if a day has assignments, latest finisher group must include at least one worker with `canClose=true`

### 9.2 Soft Objectives (optimize)

Priority order (highest weight first):

1. **Minimize coverage gaps** — penalize every unfilled required headcount slot heavily
2. **Minimize changes vs previous schedule** — primary repair objective once coverage is satisfied
3. **Monthly hour targets** — `monthlyMinHours` is a stronger soft target; `monthlyOptimalHours` is a weaker soft target
4. **Balance hours proportionally to availability** — mainly a later tie-breaker for workers without monthly hour targets
5. **Prefer longer shifts** — penalize the shortfall `(maxShiftMinutes − actualShiftMinutes)` per assignment; short shifts are a last resort for understaffing situations only

### 9.3 Flexible Shift Model (Solver v2)

The solver internally uses a **slot-demand model**:

1. Coverage windows are decomposed into time-slot demand: `required_workers[day, skill, slot]`
2. For each worker/day/skill, candidate shifts are generated with all valid `(start, end)` pairs where `minShiftMinutes ≤ (end − start) ≤ maxShiftMinutes`, start/end snap to `timeGranularityMinutes`, the shift stays inside the worker's availability, and the shift overlaps at least one demanded slot for that day+skill
3. Decision variable: `x[worker, day, skill, start, end]` ∈ {0, 1}
4. Coverage constraint: for each slot `(day, skill, t)`, `sum(x where shift covers t)` + slack ≥ required
5. One-shift constraint: `sum(x for worker on day)` ≤ 1
6. Objective: weighted sum of coverage gap penalty + repair stability + monthly hour targets + hours-balance deviation + shift-length shortfall

This allows the solver to assign a worker `10:00–18:00` that covers part of an `08:00–13:00` window and all of a `13:00–18:00` window — without requiring separate variables per coverage block.

### 9.5 Monthly Hour Targets

- `monthlyMinHours` and `monthlyOptimalHours` are global per-worker monthly targets, not per-place targets
- the solver scores targets separately per worker-month bucket, even when the generation interval spans multiple calendar months
- projected month hours are calculated as worked hours already completed in the month + already-published scheduled hours outside the current generation interval + solver-assigned hours inside the generation interval
- monthly minimum is a strong soft target; monthly optimal is a weaker soft target
- if both fields are unset, the worker falls back to availability-based balancing only

### 9.4 Rating Constraint (per skill, per staffed slot)

If `enforceMinTeamRating=true` for a place+skill, then for each staffed slot `(day, skill, slot)`:

- `assignedCount(slot) > 0` implies `avg(skillRating of assigned workers at slot) ≥ minAvgRating`
- Equivalent linear form in solver: `ratingSumScaled(slot) ≥ minAvgRatingScaled * assignedCount(slot)`

This applies to:

- single-worker slots (the worker's rating must be ≥ threshold)
- multi-worker slots (group average must be ≥ threshold)

If `enforceMinTeamRating=false`, no minimum average rating rule is applied for that skill.

---

## 10. Worker App Flows

### 10.1 Authentication (Email OTP Every Time — MVP)

- Worker enters email → receives OTP → verifies → logged in
- Rate limiting and OTP TTL enforced
- First login may request minimal profile confirmation (optional)

### 10.2 Home / Dashboard

- Home shows the worker's **next upcoming shift** (place, skill, date, time) prominently
- Below: **handoff notes** from the previous shift at that place/skill (if any)
- Unread notifications badge in navigation
- Quick-access menu to other features

### 10.3 Notifications (In-App MVP)

- Worker can view notifications and mark as read
- Only impacted workers receive schedule-change notifications (see §12)

### 10.4 Planning Calendar

- Month view
- Tapping a day shows planned blocks and coworkers for that place/skill

### 10.5 Availability Submission

Types:

- full-day
- time-range
- vacation flag (`isPaidLeave=true`)

**Critical restriction (MVP):**

- Worker cannot submit availability **after the end datetime of the currently PUBLISHED schedule** for that place.
- For dates beyond the published schedule: worker must communicate manually with Manager; Manager updates schedule when extending/publishing horizon.

### 10.6 Time Tracking (Start/Stop)

- Worker starts a work session:
  - if near a planned block (configurable grace), attach session to that block
  - otherwise choose place + skill (marked “unscheduled”)
- Stop ends session and prompts for optional handoff note

**Optional (MVP configurable): location validation**

- Place may require geolocation permission for start/stop (checked at button press)
- If denied/outside radius: either block or allow but flag to Manager (policy)

### 10.7 Checklist

- Checklist is shown during a work session
- Checklist comes from templates configured by Manager (per place+skill)
- Each work session has its own checklist instance; resets each new session

### 10.8 Shift Handoff Notes

On stop, worker can leave a note with audience:

- `NEXT_IN_SKILL`: only next worker(s) in same place+skill
- `NEXT_SHIFT_ALL`: all workers in the next shift at that place
  Recipients get a notification; notes can be marked read.

### 10.9 My Profile

- Worker can edit limited personal details (exact fields defined by product; email changes are Manager-only)

### 10.10 My Hours + Salary Preview

Worker can see:

- total worked hours this month
- approved vs pending hours
- salary estimate based on:
  - hourly rate (per worker)
  - rounding policy (config)
    MVP payroll = simple hourly model (no overtime).

### 10.11 Documents

- Worker sees list of their documents (both manager-uploaded and self-uploaded)
- Downloads via signed URLs
- Worker can upload personal documents (e.g., certificates, ID copies, medical records)
- Worker can view employment contract and other manager-assigned documents
- Document expiration is evaluated **on-read** (no scheduled job in MVP)

---

## 11. Manager Operations

### 11.1 Live “Who is Working”

Based on active work sessions (`endTime = null`), with safeguards for stuck sessions.

### 11.2 Timesheets (Review/Edit/Approve/Export)

- Manager can edit sessions with required reason + audit
- Approve a month (MVP) → locks period
- **Export CSV** (core feature):
  - Manager selects workers (checkbox list) and date range (start date, end date)
  - Downloads a CSV file with columns: `Name Surname`, `Hours during <start date> – <end date>`
  - One row per selected worker
  - Hours = sum of approved work session durations in the period

### 11.3 Documents Management

- Upload/replace/archive documents for individual workers (e.g., employment contracts)
- Upload team-wide or company-wide documents visible to all workers (exact scope TBD by product)
- Notify worker about new documents

### 11.4 Leave Management

- View pending/approved/rejected leave requests from workers
- Approve or reject leave requests with optional reason
- Forward approved leave summaries to accountant (exact workflow TBD — initial implementation may be a simple export or email)

---

## 12. Notifications (Detailed)

### 12.1 In-App Only (MVP)

Push notifications optional later.

### 12.2 Event Types (MVP minimum)

- SCHEDULE_CHANGED_FOR_WORKER (only impacted workers)
- HANDOFF_NOTE_RECEIVED
- DOCUMENT_UPLOADED
- OPEN_SHIFT_AVAILABLE
- OPEN_SHIFT_INTEREST_SUBMITTED (to Manager)
- TIMESHEET_APPROVED
- TIMESHEET_EDITED_BY_MANAGER

### 12.3 “Notify Only Impacted Workers” Rule

When publishing or repairing:

- compute diff between before and after published assignments in interval
- only workers with changed assignments receive schedule-change notification

### 12.4 Read/Unread

- notifications are stored with `readAt`
- worker can mark individual or all read

---

## 13. Open Shifts

### 13.1 Definition

Open shift = unfilled coverage window/segment requiring staffing.

### 13.2 Worker

- sees eligible open shifts (place + skill + no conflicts)
- can submit interest (“I’m available”)

### 13.3 Manager

- reviews interests
- approves worker(s) up to missingCount
- approval revalidates schedule constraints (and creates draft/publish per policy)

---

## 14. Documents (Detailed)

### 14.1 Storage & Access

- store in Supabase Storage
- serve via signed URLs only

### 14.2 Document Scopes

- **Worker-specific (manager-uploaded):** employment contracts, individual notices — visible only to that worker
- **Worker-specific (self-uploaded):** certificates, ID copies — visible to the worker and their manager
- **Team / Company-wide:** company policies, handbooks, announcements — visible to all workers in the company (exact scoping rules TBD by product)

### 14.3 States

- ACTIVE / REPLACED / ARCHIVED / EXPIRED
- expiration evaluated on-read when listing or requesting download

---

## 15. Non-Functional Requirements

### 15.1 Security

- Supabase RLS on all tables
- company isolation
- signed URLs for documents
- audit log for sensitive actions (session edits, document access optional)

### 15.2 Performance

- Generate schedule for typical place/week should complete within acceptable time (target: < 10–20s MVP; refine later)
- UI should remain responsive; draft generation may show progress state

### 15.3 Reliability

- ScheduleVersion history is immutable
- Idempotent generation calls where possible
- Clear error messaging for infeasible schedules

---

## 16. Billing & Subscription

> **Note:** Not needed for initial testing/early clients (manual billing). Implement when scaling.

### 16.1 Overview

- Integrated via **Stripe** (Checkout + Customer Portal + Webhooks)
- Multiple subscription tiers (e.g., Starter, Professional, Enterprise)
- Custom tier: prospect fills out a form (company size, number of managers, worker count, required features) and receives a tailored quote

### 16.2 Manager / Company Admin View

- View current subscription tier and billing cycle
- Upgrade / downgrade tier
- View invoice history
- Contact support / request custom plan

### 16.3 Webhook Integration

- Stripe webhooks activate/deactivate company subscription status
- On deactivation: company enters read-only mode (no new schedules, no new workers)
- Grace period and notifications before hard deactivation (TBD)

---

## 17. MVP vs V1 Roadmap

### MVP

- All features defined in this document (excluding §16 Billing and deferred items in §2.2)
- Auth: Email OTP for workers/managers; email+password for company admin
- In-app notifications only
- Expiration on-read
- Simple hourly pay
- CSV export for payroll
- Vacation accrual tracking

### V1+

- Stripe billing & subscription management (§16)
- Native mobile app (React Native + Expo) for Worker role
- SMS/Phone OTP login option
- Push notifications
- Recurring availability
- Advanced fairness optimization
- Rich payroll rules (overtime etc.)
- Better infeasible explanation tooling
- Optional stronger location enforcement (if platform permits)

---

## 18. Acceptance Criteria Checklist (High Level)

- Manager can configure place skills + weekly coverage + settings
- Manager can CRUD workers (email OTP login), assign places, set skill ratings
- Generate draft schedule for interval within plan horizon
- Draft overlay compare; publish overwrites only within interval; history exists
- Manual overrides create locks; draft revalidation blocks publish if invalid
- Worker sees published schedule only
- Worker dashboard shows next upcoming shift + handoff notes from previous shift
- Worker can submit availability only within published horizon
- Availability triggers repair (within horizon) with minimal changes + notify only impacted workers
- Open shifts show gaps; worker can express interest; Manager approves
- Worker start/stop time tracking; Manager can view "currently working"
- Timesheets editable with audit; approval locks; CSV export works (select workers + date range)
- Worker can view vacation balance (accrued, used, remaining)
- Manager can approve/reject leave requests
- Documents upload/download with signed URLs; expiration on-read
- Worker can upload personal documents; view employment contract docs
- Company Admin can reassign places between managers
- Notifications list + read/unread works

---

## Appendix A — API Contracts (Sketch)

### A.1 Scheduler Service (Python) — `POST /solve`

Input (conceptual):

- placeId, interval
- coverage windows expanded
- workers + eligibility + startDate + skillRatings
- unavailability
- previousAssignments (for minimal change)
- lockedAssignments
- place settings

Output:

- status (OPTIMAL/FEASIBLE/INFEASIBLE)
- assignments (blocks)
- diagnostics (gaps, reasons)

### A.2 App Endpoints (Conceptual)

- Auth: request/verify OTP
- Manager: places, skills, place config, coverage template, settings
- Manager: workers CRUD
- Manager: generate/publish/repair schedules
- Worker: planning, availability, open shifts interest
- Worker: start/stop sessions, checklist, notes
- Manager: timesheets approve/export
- Documents: list + signed download link
- Notifications: list + mark read
