from contextlib import closing
import sqlite3
from typing import Literal

from fastapi import HTTPException
from pydantic import BaseModel, Field, field_validator

from .database import connect_database, initialize_database

StudentStatus = Literal["active", "paused", "completed", "archived"]


class StudentCreate(BaseModel):
    full_name: str = Field(min_length=1)
    phone: str = Field(min_length=1)
    course_type: str = Field(min_length=1)
    joining_date: str = Field(min_length=1)
    status: StudentStatus = "active"
    alternate_phone: str = ""
    email: str = ""
    address: str = ""
    date_of_birth: str | None = None
    total_fee_amount: int = Field(default=0, ge=0)
    learner_permit_number: str = ""
    learner_permit_expiry_date: str | None = None
    license_number: str = ""
    notes: str = ""

    @field_validator(
        "full_name",
        "phone",
        "course_type",
        "joining_date",
        "alternate_phone",
        "email",
        "address",
        "learner_permit_number",
        "license_number",
        "notes",
    )
    @classmethod
    def trim_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("full_name", "phone", "course_type", "joining_date")
    @classmethod
    def require_text(cls, value: str) -> str:
        if not value:
            raise ValueError("This field is required")

        return value

    @field_validator("date_of_birth", "learner_permit_expiry_date")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None

        trimmed_value = value.strip()
        return trimmed_value or None


def student_row_to_dict(row: sqlite3.Row) -> dict:
    return dict(row)


def create_student(payload: StudentCreate) -> dict:
    initialize_database()

    with closing(connect_database()) as connection:
        try:
            cursor = connection.execute(
                """
                INSERT INTO students (
                    full_name,
                    phone,
                    alternate_phone,
                    email,
                    address,
                    date_of_birth,
                    course_type,
                    joining_date,
                    status,
                    total_fee_amount,
                    learner_permit_number,
                    learner_permit_expiry_date,
                    license_number,
                    notes
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload.full_name,
                    payload.phone,
                    payload.alternate_phone,
                    payload.email,
                    payload.address,
                    payload.date_of_birth,
                    payload.course_type,
                    payload.joining_date,
                    payload.status,
                    payload.total_fee_amount,
                    payload.learner_permit_number,
                    payload.learner_permit_expiry_date,
                    payload.license_number,
                    payload.notes,
                ),
            )
        except sqlite3.IntegrityError as error:
            if "students.phone" in str(error) or "UNIQUE" in str(error):
                raise HTTPException(
                    status_code=409,
                    detail="A student with this phone number already exists.",
                ) from error

            raise HTTPException(status_code=400, detail="Student data is invalid.") from error

        student_id = int(cursor.lastrowid)
        connection.execute(
            """
            INSERT INTO activity_log (student_id, activity_type, description)
            VALUES (?, ?, ?)
            """,
            (student_id, "student_created", f"Student registered: {payload.full_name}"),
        )
        student = connection.execute(
            """
            SELECT
                students.*,
                student_payment_summary.paid_amount,
                student_payment_summary.pending_amount
            FROM students
            JOIN student_payment_summary
                ON student_payment_summary.student_id = students.id
            WHERE students.id = ?
            """,
            (student_id,),
        ).fetchone()
        connection.commit()

    return student_row_to_dict(student)


def list_students(
    search: str | None = None,
    status: str | None = None,
) -> list[dict]:
    initialize_database()

    conditions: list[str] = []
    params: list[str] = []

    if status and status != "all":
        conditions.append("students.status = ?")
        params.append(status)
    else:
        conditions.append("students.status != 'archived'")

    if search:
        term = f"%{search.strip().lower()}%"
        conditions.append("(LOWER(students.full_name) LIKE ? OR students.phone LIKE ?)")
        params.extend([term, term])

    where_clause = "WHERE " + " AND ".join(conditions)

    query = f"""
        SELECT
            students.id,
            students.full_name,
            students.phone,
            students.course_type,
            students.joining_date,
            students.status,
            students.total_fee_amount,
            student_payment_summary.paid_amount,
            student_payment_summary.pending_amount,
            (
                SELECT MIN(training_days.training_date)
                FROM training_days
                WHERE training_days.student_id = students.id
                  AND training_days.training_date >= date('now')
                  AND training_days.status = 'planned'
            ) AS next_training_date
        FROM students
        JOIN student_payment_summary
            ON student_payment_summary.student_id = students.id
        {where_clause}
        ORDER BY datetime(students.created_at) DESC, students.id DESC
    """

    with closing(connect_database()) as connection:
        rows = connection.execute(query, params).fetchall()

    return [student_row_to_dict(row) for row in rows]
