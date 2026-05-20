from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .dashboard import get_dashboard_data
from .database import database_path, initialize_database, verify_database
from .payments import PaymentCreate, create_payment
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
        "database_path": str(database_path()),
    }


@app.get("/dashboard")
def dashboard() -> dict:
    return get_dashboard_data()


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


static_dir = Path(__file__).resolve().parents[1] / "static"

if static_dir.exists():
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
