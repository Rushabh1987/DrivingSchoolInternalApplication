from contextlib import asynccontextmanager
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .ai import generate_dashboard_insights, generate_payment_reminder
from .dashboard import get_dashboard_data
from .database import initialize_database, verify_database
from .payments import PaymentCreate, create_payment
from .reports import (
    export_payments_csv,
    export_students_csv,
    get_payments_report,
    get_pending_fees_report,
    get_students_report,
    get_training_days_report,
)
from .students import StudentCreate, StudentUpdate, archive_student, create_student, get_student, list_students, update_student
from .training_days import TrainingDayCreate, create_training_day, delete_training_day, update_training_day


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield


app = FastAPI(
    title="Driving School Admin API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict[str, str]:
    verify_database()

    return {
        "status": "ok",
        "service": "driving-school-backend",
        "database": "ok",
    }


@app.get("/dashboard")
def dashboard() -> dict:
    return get_dashboard_data()


@app.get("/dashboard/insights")
def dashboard_insights() -> dict:
    try:
        text = generate_dashboard_insights()
        return {"insights": text}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/students")
def students(
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
) -> list[dict]:
    return list_students(search=search, status=status)


@app.post("/students", status_code=201)
def register_student(payload: StudentCreate) -> dict:
    return create_student(payload)


@app.get("/students/{student_id}")
def student_detail(student_id: int) -> dict:
    return get_student(student_id)


@app.put("/students/{student_id}")
def update_student_route(student_id: int, payload: StudentUpdate) -> dict:
    return update_student(student_id, payload)


@app.patch("/students/{student_id}/archive")
def archive_student_route(student_id: int) -> dict:
    return archive_student(student_id)


@app.get("/students/{student_id}/payment-reminder")
def payment_reminder(student_id: int) -> dict:
    student = get_student(student_id)
    try:
        text = generate_payment_reminder(student["full_name"], student["pending_amount"])
        return {"reminder": text}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/students/{student_id}/payments", status_code=201)
def add_payment(student_id: int, payload: PaymentCreate) -> dict:
    return create_payment(student_id, payload)


@app.post("/students/{student_id}/training-days", status_code=201)
def add_training_day(student_id: int, payload: TrainingDayCreate) -> dict:
    return create_training_day(student_id, payload)


@app.put("/training-days/{day_id}")
def update_training_day_route(day_id: int, payload: TrainingDayCreate) -> dict:
    return update_training_day(day_id, payload)


@app.delete("/training-days/{day_id}", status_code=204)
def delete_training_day_route(day_id: int) -> None:
    delete_training_day(day_id)


@app.get("/reports/students")
def report_students(status: str | None = Query(default=None)) -> dict:
    return get_students_report(status=status)


@app.get("/reports/students/csv")
def report_students_csv(status: str | None = Query(default=None)):
    return export_students_csv(status=status)


@app.get("/reports/payments")
def report_payments(
    from_date: str | None = Query(default=None),
    to_date: str | None = Query(default=None),
) -> dict:
    return get_payments_report(from_date=from_date, to_date=to_date)


@app.get("/reports/payments/csv")
def report_payments_csv(
    from_date: str | None = Query(default=None),
    to_date: str | None = Query(default=None),
):
    return export_payments_csv(from_date=from_date, to_date=to_date)


@app.get("/reports/pending-fees")
def report_pending_fees() -> dict:
    return get_pending_fees_report()


@app.get("/reports/training-days")
def report_training_days(
    from_date: str | None = Query(default=None),
    to_date: str | None = Query(default=None),
) -> dict:
    return get_training_days_report(from_date=from_date, to_date=to_date)


static_dir = Path(__file__).resolve().parents[1] / "static"

if static_dir.exists():
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
