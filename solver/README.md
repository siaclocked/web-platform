# Clocked Solver Service

A Python-based schedule optimization service using Google OR-Tools CP-SAT solver.

## Overview

This service generates optimal work schedules based on:
- Worker skills and availability
- Coverage requirements
- Hard constraints (place eligibility, start date, max daily hours, rest periods, locks, etc.)
- Soft objectives (coverage, repair stability, monthly hour targets, balance, shift length)

## Running Locally

### Prerequisites
- Python 3.11+
- pip

### Installation

```bash
cd solver
pip install -r requirements.txt
```

### Running the Server

```bash
python main.py
```

Or with uvicorn directly:

```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

### API Documentation

Once running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Docker

### Build

```bash
docker build -t clocked-solver .
```

### Run

```bash
docker run -p 8000:8000 clocked-solver
```

## API Endpoints

### POST /solve

Generate an optimized schedule.

**Request Body:**
```json
{
  "place_id": "uuid",
  "start_date": "2024-01-15",
  "end_date": "2024-01-21",
  "workers": [...],
  "coverage_windows": [...],
  "existing_assignments": [...],
  "unavailability": [...],
  "worker_month_context": [...],
  "settings": {...},
  "minimize_changes": true,
  "balance_hours": true
}
```

**Response:**
```json
{
  "status": "OPTIMAL|FEASIBLE|INFEASIBLE",
  "assignments": [...],
  "coverage_gaps": [...],
  "diagnostics": [...],
  "constraint_violations": [...],
  "solve_time_ms": 150,
  "total_hours_by_worker": {...}
}
```

### POST /validate

Validate a schedule without solving. Uses `existing_assignments` from the request as the schedule under validation and returns `is_valid` plus structured `constraint_violations`.

### GET /health

Health check endpoint.

## Constraints

### Hard Constraints
- Workers can only work skills they have
- Workers must be eligible for the place being solved
- Workers cannot be scheduled before `start_date`
- Workers cannot work when unavailable
- Maximum one shift per worker per day
- Minimum rest between consecutive-day shifts
- Locked assignments must be honored

### Soft Objectives (Minimized)
1. Coverage gaps (highest priority)
2. Repair stability / minimal changes
3. Monthly minimum and optimal hour targets
4. Hour imbalance between workers without monthly targets
5. Shift-length preferences
