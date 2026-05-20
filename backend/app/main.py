from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .dashboard import get_dashboard_data
from .database import database_path, initialize_database, verify_database
from .students import StudentCreate, create_student, list_students


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


static_dir = Path(__file__).resolve().parents[1] / "static"

if static_dir.exists():
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
