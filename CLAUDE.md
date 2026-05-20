# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Internal admin-only driving school management app. One admin user, no public-facing pages. Read `AGENTS.md` for full business requirements and `PLAN.md` for the implementation roadmap before starting any feature work.

## Stack

- **Frontend**: Next.js 16 + TypeScript + Tailwind CSS v4, static export mode
- **Backend**: Python FastAPI served via uvicorn, also serves the built Next.js site at `/`
- **Database**: SQLite, auto-initialized on startup
- **Package manager**: `uv` for Python, `npm` for frontend
- **Container**: Docker (multi-stage build)

## Development commands

**Backend** (from `backend/`):
```
uv run uvicorn app.main:app --reload
```
Runs at http://localhost:8000

**Frontend** (from `frontend/`):
```
npm run dev
```
Runs at http://localhost:3000

**Backend tests** (from `backend/`):
```
uv run pytest
uv run pytest tests/test_students.py   # single file
```

**Frontend lint** (from `frontend/`):
```
npm run lint
```

**Docker**:
```
docker compose up --build
```

## Architecture

### Backend (`backend/app/`)
- `main.py` — FastAPI app, lifespan handler calls `initialize_database()`, mounts built frontend at `/` if `static/` exists
- `database.py` — SQLite schema, `connect_database()`, `initialize_database()`. Database path controlled by `DRIVING_SCHOOL_DB_PATH` env var; defaults to `backend/data/driving_school.db`
- `students.py` — student CRUD endpoints and Pydantic models
- `dashboard.py` — dashboard aggregation queries

All DB access uses `contextlib.closing` with raw sqlite3. Foreign keys enabled via `PRAGMA`. Fees are stored as integers (paise/cents).

### Frontend (`frontend/`)
Next.js static export (`output: export` in next.config). Built files go to `out/`, which gets copied to `backend/static/` in the Docker build so FastAPI can serve them.

Login is client-side only: hardcoded credentials (`admin`/`password`), session stored in sessionStorage (expires on tab close), 12-hour TTL enforced in JS.

### Database schema
Five tables: `students`, `training_days`, `payments`, `activity_log`, `app_metadata`. One view: `student_payment_summary` (calculates paid/pending from payments rows). Cascade deletes on student removal. Student phone is UNIQUE. All enum columns use SQLite CHECK constraints.

## Coding rules (from AGENTS.md)

- No emojis anywhere in UI copy or documentation
- Archive students instead of deleting them (`status = 'archived'`)
- All writes validated server-side in FastAPI
- Financial changes must be traceable — never edit payment rows, only append
- Identify root cause before fixing bugs; do not guess
- Do not remove or rewrite user-created work unless explicitly asked
- Keep forms and layouts responsive for both mobile and laptop

## Color scheme

| Name | Hex | Use |
|------|-----|-----|
| Road Yellow | `#f5b700` | Accents, schedule highlights |
| Signal Green | `#2f9e44` | Completed / paid status |
| Brake Red | `#d64545` | Missed / overdue / errors |
| Asphalt Navy | `#1f2937` | Headings, nav, primary text |
| Sky Blue | `#2563eb` | Links, primary actions |
| Light Gray | `#f3f4f6` | Page backgrounds |
| Border Gray | `#d1d5db` | Borders, dividers |
| Text Gray | `#6b7280` | Labels, supporting text |

## Implementation status

Parts 1–8 of `PLAN.md` are complete (scaffolding, login, database, dashboard API, student registration API + tests, student list UI, student profile). Parts 9–14 are not yet started: training days UI, payments UI, reports, responsive polish, frontend tests, deployment docs.
