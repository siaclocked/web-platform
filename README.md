# Clocked - Worker Scheduling Made Simple

A modern Progressive Web App (PWA) for worker clock-in, schedule management, and employee document centralization.

## Features

### For Workers
- **Phone OTP Login** - Secure authentication via SMS
- **Schedule View** - Calendar view of assigned shifts
- **Time Tracking** - Clock in/out with handoff notes
- **Availability Submission** - Set availability within published horizon
- **Documents** - View and download shared documents
- **Hours & Pay Preview** - Track worked hours and salary estimates

### For Managers
- **Smart Scheduling** - AI-powered schedule generation using OR-Tools CP-SAT
- **Place Management** - Manage multiple work locations
- **Worker Management** - Add workers, assign skills and places
- **Timesheet Approval** - Review, edit, and approve timesheets
- **Document Sharing** - Upload and manage worker documents
- **Live Dashboard** - See who's currently working

### For Company Admins
- **Company Settings** - Configure organization details
- **Manager Accounts** - Create and manage manager accounts

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS 4, Dark Navy Theme
- **Backend**: Next.js API Routes, Server Actions
- **Database**: Supabase (PostgreSQL with RLS)
- **Auth**: Supabase Phone OTP
- **Storage**: Supabase Storage (signed URLs)
- **Solver**: Python FastAPI + Google OR-Tools CP-SAT
- **PWA**: Progressive Web App with offline support

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+ (for solver service)
- Supabase account

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `env.example` to `.env.local` and fill in your Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SOLVER_SERVICE_URL=http://localhost:8000
```

### 3. Set Up Database

Run the SQL migrations in your Supabase dashboard:
- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_rls_policies.sql`

### 4. Start the Solver Service

```bash
cd solver
pip install -r requirements.txt
python main.py
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Project Structure

```
clocked/
├── app/                    # Next.js App Router
│   ├── (app)/              # Authenticated app routes
│   │   ├── dashboard/      # Role-based dashboards
│   │   ├── schedule/       # Worker schedule view
│   │   ├── time-tracking/  # Clock in/out
│   │   ├── availability/   # Availability submission
│   │   ├── documents/      # Document viewer
│   │   ├── profile/        # User profile
│   │   ├── notifications/  # Notifications
│   │   ├── places/         # Manager: places
│   │   ├── workers/        # Manager: workers
│   │   ├── schedules/      # Manager: schedules
│   │   ├── timesheets/     # Manager: timesheets
│   │   ├── company/        # Admin: company settings
│   │   └── managers/       # Admin: manager accounts
│   ├── api/                # API routes
│   ├── login/              # Phone OTP login
│   └── page.tsx            # Landing page
├── components/
│   ├── ui/                 # Reusable UI components
│   ├── layout/             # Layout components
│   └── providers/          # Context providers
├── lib/
│   ├── supabase/           # Supabase clients
│   ├── store/              # Zustand stores
│   ├── types/              # TypeScript types
│   └── utils.ts            # Utility functions
├── solver/                 # Python solver service
│   ├── main.py             # FastAPI application
│   ├── requirements.txt    # Python dependencies
│   └── Dockerfile          # Docker configuration
├── supabase/
│   └── migrations/         # SQL migrations
└── public/
    └── manifest.json       # PWA manifest
```

## User Roles & Permissions

| Feature | Admin | Manager | Worker |
|---------|-------|---------|--------|
| Company Settings | | | |
| Manage Managers | | | |
| Manage Places | | | |
| Manage Workers | | | |
| Generate Schedules | | | |
| Approve Timesheets | | | |
| Upload Documents | | | |
| View Schedule | | | |
| Clock In/Out | | | |
| Submit Availability | | | |
| View Documents | | | |

## Hard Constraints

The scheduler enforces these rules:
- Workers can only work skills they have
- Workers can only work at assigned places
- A worker cannot work at two different places on the same day
- Workers cannot be scheduled when unavailable
- Minimum rest period between shifts
- Maximum hours per day

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/schedules/solve` | Generate optimized schedule |
| POST | `/api/schedules/publish` | Publish schedule draft |
| GET/POST | `/api/time-tracking` | Start/stop work sessions |
| GET/PATCH | `/api/notifications` | Get/mark notifications |
| GET/POST | `/api/documents` | List/upload documents |
| GET | `/api/documents/[id]/download` | Get signed download URL |

## License

MIT
