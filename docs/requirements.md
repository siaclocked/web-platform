# Shift Scheduling Platform (PWA) — Master Requirements (MVP)

**Document status:** Draft  
**Language:** English (UI may be bilingual later)  
**Key roles terminology:** Use **Manager** for the manager role.

---

## 0. Document Control

- **Owner:** Product/Engineering
- **Goal:** Single source of truth for building the MVP with Windsurf
- **Change process:** Any change must be reflected in this file; feature decisions should be recorded under “Decisions”.

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

### 1.2 Expected Improvements

Automation should:

- Generate schedules automatically under hard constraints.
- Track worked hours accurately via time tracking.
- Centralize employee documents.
- Provide transparent hours and pay estimates.
- Simplify vacation/leave processes (MVP: basic).

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

### 2.2 Out of Scope (MVP)

- Native mobile app stores
- Guaranteed background geofencing / always-on lockscreen timer (platform-limited in PWA)
- Complex payroll (overtime, allowances, tax, etc.) beyond hourly
- Recurring availability patterns (e.g., every Monday) — later
- Multi-place assignments within the same day (explicitly forbidden)
- Advanced fairness optimization (placeholder only)

---

## 3. Users, Roles, Permissions

### 3.1 Roles

- **Company Admin (Your team):** Creates company + Manager account(s)
- **Manager:** Configures places, skills, workers, schedules, approvals
- **Worker:** Views schedule, sets availability (within published horizon), time tracking, docs, notes, checklist

### 3.2 Permissions (High Level)

- Company Admin: create company, create Manager accounts
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
- optional minAvgRating threshold (per place+skill)

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
Accrual formula is configurable later (placeholder in MVP).

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
  - Endpoint: `/solve` (and optional `/validate`)
  - Returns assignments + diagnostics

### 5.2 Scheduler Contract (High-Level)

Inputs:

- place, interval
- expanded coverage windows
- workers (eligibility, start date, skill ratings)
- unavailability
- existing assignments (previous schedule for minimal change)
- locked assignments (manual overrides)
- place settings (hours/block/rest/granularity)
  Outputs:
- status: OPTIMAL/FEASIBLE/INFEASIBLE
- assignments (blocks) per worker
- diagnostics (coverage gaps, constraint violations summary)

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

- `minAvgRating` (nullable)

### 7.4 Weekly Coverage Template (per Place + Skill)

Manager defines weekly windows per skill:

- dayOfWeek, startTime, endTime, minCount, maxCount
- multiple windows/day supported (chunks)
- MVP: no overlap within the same skill/day for a place

### 7.5 Place Scheduling Settings

Per place:

- `timeGranularityMinutes` (15/30/60)
- `minHoursPerDay`, `maxHoursPerDay`
- optional `minHoursPerWeek`, `maxHoursPerWeek`
- `blockMinMinutes`, `blockMaxMinutes`
  - “No blocks” = blockMin = blockMax = maxHoursPerDay \* 60
- `minRestMinutesBetweenBlocks`
- optional `maxBlocksPerDayPerWorker`

### 7.6 Worker Management (CRUD)

Create/edit:

- name, email (unique)
- status (INVITED/ACTIVE/DISABLED)
- place scope: ALL or selected places
- start date (solver eligibility begins on/after this date)
- skills + rating per skill (scale defined by company; e.g., 1–10)
- hourly rate (for pay estimate)

---

## 8. Scheduling: Generation, Drafts, Publish, History, Overrides, Repair

### 8.1 Generate Schedule for Interval

- Manager selects `from` and `to` and clicks **Generate/Schedule**
- Plan limit: `to` must be within `MAX_FUTURE_DAYS` (e.g., 14 or 30) from “today” (place timezone)

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

- Coverage min/max per window+skill
- Avg rating threshold per place+skill per window (if set)
- Worker availability
- No overlap
- One place per day per worker
- Hours/day/week limits
- Block duration limits
- Min rest between blocks

If invalid:

- draft status = INVALID
- Publish disabled
- show diagnostics; allow “Repair interval”

### 8.6 Repair / Minimal Change

When repairing (due to availability change or manager action):

- previous baseline = current published (or current draft if in draft mode)
- objective: minimize changes (highest weight), while satisfying hard constraints
- locked overrides are treated as hard constraints

### 8.7 Infeasible Handling

If solver returns INFEASIBLE:

- draft marked INVALID
- show “Unfilled Coverage Report” with day/time/skill/missing count
- Manager actions: adjust coverage, adjust thresholds, add workers, relax constraints, regenerate

---

## 9. Constraints (Hard vs Soft)

### 9.1 Hard Constraints (must always hold)

- Coverage: min ≤ assignedCount ≤ max for every place+window+skill
- Eligibility: worker has skill rating, is assigned to place (or ALL), startDate reached
- Availability: no assignment overlapping unavailability
- No overlap: worker cannot be assigned to two blocks at overlapping times
- One place per day: worker cannot be scheduled in 2 places on same day
- Hours: within configured min/max per day/week (if enabled)
- Blocks: within block min/max duration
- Rest: min rest time between blocks

### 9.2 Soft Objectives (optimize)

- Minimal change vs previous schedule (primary objective during repair)
- Fairness balancing (placeholder; can be added later)

### 9.3 Rating Constraint (per skill, per window)

For each coverage window + skill:

- average(skillRating) among assigned workers must be ≥ minAvgRating (if configured for the place+skill)

---

## 10. Worker App Flows

### 10.1 Authentication (Email OTP Every Time — MVP)

- Worker enters email → receives OTP → verifies → logged in
- Rate limiting and OTP TTL enforced
- First login may request minimal profile confirmation (optional)

### 10.2 Home + Navigation

- Home shows feature menu and unread notifications badge

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

- Worker sees list of their documents
- Downloads via signed URLs
- Document expiration is evaluated **on-read** (no scheduled job in MVP)

---

## 11. Manager Operations

### 11.1 Live “Who is Working”

Based on active work sessions (`endTime = null`), with safeguards for stuck sessions.

### 11.2 Timesheets (Review/Edit/Approve/Export)

- Manager can edit sessions with required reason + audit
- Approve a month (MVP) → locks period
- Export CSV per worker and/or place summary

### 11.3 Documents Management

- Upload/replace/archive documents for a worker
- Notify worker about new documents

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

### 14.2 States

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

## 16. MVP vs V1 Roadmap

### MVP

- All features defined in this document
- Auth: Email OTP for workers/managers; email+password for company admin
- In-app notifications only
- Expiration on-read
- Simple hourly pay

### V1+

- SMS/Phone OTP login option
- Push notifications
- Recurring availability
- Advanced fairness optimization
- Rich payroll rules (overtime etc.)
- Better infeasible explanation tooling
- Optional stronger location enforcement (if platform permits)

---

## 17. Acceptance Criteria Checklist (High Level)

- Manager can configure place skills + weekly coverage + settings
- Manager can CRUD workers (email OTP login), assign places, set skill ratings
- Generate draft schedule for interval within plan horizon
- Draft overlay compare; publish overwrites only within interval; history exists
- Manual overrides create locks; draft revalidation blocks publish if invalid
- Worker sees published schedule only
- Worker can submit availability only within published horizon
- Availability triggers repair (within horizon) with minimal changes + notify only impacted workers
- Open shifts show gaps; worker can express interest; Manager approves
- Worker start/stop time tracking; Manager can view “currently working”
- Timesheets editable with audit; approval locks; CSV export works
- Documents upload/download with signed URLs; expiration on-read
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
