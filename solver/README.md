# Clocked Solver Service

A Python-based schedule optimization service using Google OR-Tools CP-SAT solver.

## Overview

This service generates optimal work schedules based on:
- Worker skills and availability
- Coverage requirements
- Hard constraints (max hours, rest periods, etc.)
- Soft objectives (minimize changes, balance hours)

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
  "solve_time_ms": 150,
  "total_hours_by_worker": {...}
}
```

### POST /validate

Validate a schedule without solving.

### GET /health

Health check endpoint.

## Constraints

### Hard Constraints
- Workers can only work skills they have
- Workers cannot work when unavailable
- Maximum one shift per worker per day
- Locked assignments must be honored

### Soft Objectives (Minimized)
1. Coverage gaps (highest priority)
2. Hour imbalance between workers
3. Changes from existing assignments
