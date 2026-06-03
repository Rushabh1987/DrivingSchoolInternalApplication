# Driving School Internal Management App

An admin-only web application for managing students, training sessions, payments, and reports at a driving school. Built for use on both mobile and laptop.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| Backend | Python FastAPI, uvicorn |
| Database | PostgreSQL (Supabase) |
| AI | OpenRouter (free models) |
| Container | Docker |

---

## Local Development Setup

### Prerequisites

- Node.js 18+
- Python 3.11+
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- A Supabase project (free tier works)

### 1. Clone the repository

```bash
git clone https://github.com/Rushabh1987/DrivingSchoolInternalApplication
cd DrivingSchoolInternalApplication
```

### 2. Set up environment variables

Create a `.env` file in the project root:

```
DATABASE_URL=postgresql://postgres:<password>@<host>:5432/postgres
OPENROUTER_API_KEY=sk-or-v1-...
```

- `DATABASE_URL` — from Supabase: Settings > Database > Connection string > URI
- `OPENROUTER_API_KEY` — from [openrouter.ai/keys](https://openrouter.ai/keys) (free account works)

### 3. Start the backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

Backend runs at **http://localhost:8000**. The database schema is created automatically on first startup.

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at **http://localhost:3000**.

### 5. Log in

Open http://localhost:3000 in your browser.

- Username: `admin`
- Password: `password`

Sessions expire after 12 hours or when the browser tab is closed.

---

## Running with Docker

```bash
docker compose up --build
```

The app will be available at **http://localhost:8000** (backend serves the built frontend).

---

## Project Structure

```
/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app and all routes
│   │   ├── database.py      # PostgreSQL schema and connection
│   │   ├── students.py      # Student CRUD and models
│   │   ├── training_days.py # Training day CRUD
│   │   ├── payments.py      # Payment creation
│   │   ├── dashboard.py     # Dashboard aggregation queries
│   │   ├── reports.py       # Reports and CSV export
│   │   └── ai.py            # OpenRouter AI features
│   ├── tests/               # Backend pytest tests
│   └── pyproject.toml
├── frontend/
│   └── src/app/
│       └── page.tsx         # Entire frontend (single-file SPA)
├── docs/                    # Design specs and plans
├── .env                     # Environment variables (not committed)
└── docker-compose.yml
```

---

## Features Completed

### Authentication
- Hardcoded admin login (username/password)
- Session stored in sessionStorage, expires after 12 hours
- All pages protected behind login

### Dashboard
- Total students, active students, today's training sessions, pending fees — all as clickable stat cards
- Clicking a stat card opens a modal with the filtered list of students or sessions
- AI Insights card — auto-generated observations about your school data on every page load (powered by OpenRouter)
- Quick actions: Add student, view today's training
- Recently added students list

### Student Management
- Register new students with full details (name, phone, course, fees, permit info, notes)
- Search students by name or phone number
- Filter by status: Active, Paused, Completed, Archived
- Student list with compact cards on mobile and table on laptop
- Student profile with all details, fee summary, training history, payment history, and activity log
- Edit student details and status
- Archive students (soft delete — data is preserved)

### Training Days
- Add training sessions per student (date, time, instructor, status)
- Statuses: Planned, Completed, Cancelled, Missed
- Edit or delete training sessions
- Today's sessions shown on the dashboard

### Payments
- Record payments with date, amount, method, and receipt number
- Auto-calculated paid and pending amounts
- Full payment history on student profile
- Pending fees highlighted on dashboard and reports

### Reports
- Students report by status
- Payments report by date range
- Pending fees report
- Training days report by date range
- CSV export for students and payments

### AI Features (powered by OpenRouter)
- **Dashboard Insights** — AI reads your live data and surfaces 2–3 actionable observations each time you open the dashboard
- **Payment Reminder Draft** — on any student profile with pending fees, click "Draft Reminder" to generate a ready-to-send WhatsApp message; copy with one click or regenerate

### Responsive Design
- All screens work on mobile and laptop
- Mobile: compact card layouts, touch-friendly buttons
- Laptop: wider tables, more information density

---

## What Is Still Pending

| Item | Status |
|---|---|
| Frontend unit tests | Not started |
| End-to-end tests | Not started |
| Backend tests | Done |
| Manual QA checklist | Done (`docs/qa-checklist.md`) |

---

## Backend API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/dashboard` | Dashboard counts and lists |
| GET | `/dashboard/insights` | AI-generated insights |
| GET | `/students` | List students (search, filter) |
| POST | `/students` | Register a student |
| GET | `/students/{id}` | Student detail |
| PUT | `/students/{id}` | Update student |
| PATCH | `/students/{id}/archive` | Archive student |
| GET | `/students/{id}/payment-reminder` | AI payment reminder draft |
| POST | `/students/{id}/payments` | Add payment |
| POST | `/students/{id}/training-days` | Add training day |
| PUT | `/training-days/{id}` | Update training day |
| DELETE | `/training-days/{id}` | Delete training day |
| GET | `/reports/students` | Students report |
| GET | `/reports/payments` | Payments report |
| GET | `/reports/pending-fees` | Pending fees report |
| GET | `/reports/training-days` | Training days report |
| GET | `/reports/students/csv` | Students CSV export |
| GET | `/reports/payments/csv` | Payments CSV export |
