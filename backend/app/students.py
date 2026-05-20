from contextlib import closing
import sqlite3
from typing import Literal

from fastapi import HTTPException
from pydantic import BaseModel, Field, field_validator

from .database import connect_database, initialize_database

StudentStatus = Literal["active", "paused", "completed", "archived"]
ActiveStudentStatus = Literal["active", "paused", "completed"]


class StudentCreate(BaseModel):
    full_name: str = Field(min_length=1)
    phone: str = Field(min_length=1)
    course_type: str = ""
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

    @field_validator("full_name", "phone", "joining_date")
    @classmethod
    def require_text(cls, value: str) -> str:
        if not value:
            raise ValueError("This field is required")
        return value

    @field_validator("phone")
    @classmethod
    def validate_phone_digits(cls, value: str) -> str:
        if not value.isdigit() or len(value) != 10:
            raise ValueError("Phone number must be exactly 10 digits.")
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
                SELECT COUNT(*)
                FROM training_days
                WHERE training_days.student_id = students.id
                  AND training_days.status = 'completed'
            ) AS completed_training_days
        FROM students
        JOIN student_payment_summary
            ON student_payment_summary.student_id = students.id
        {where_clause}
        ORDER BY datetime(students.created_at) DESC, students.id DESC
    """

    with closing(connect_database()) as connection:
        rows = connection.execute(query, params).fetchall()

    return [student_row_to_dict(row) for row in rows]


class StudentUpdate(BaseModel):
    full_name: str = Field(min_length=1)
    phone: str = Field(min_length=1)
    course_type: str = ""
    joining_date: str = Field(min_length=1)
    status: ActiveStudentStatus = "active"
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

    @field_validator("full_name", "phone", "joining_date")
    @classmethod
    def require_text(cls, value: str) -> str:
        if not value:
            raise ValueError("This field is required")
        return value

    @field_validator("phone")
    @classmethod
    def validate_phone_digits(cls, value: str) -> str:
        if not value.isdigit() or len(value) != 10:
            raise ValueError("Phone number must be exactly 10 digits.")
        return value

    @field_validator("date_of_birth", "learner_permit_expiry_date")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


def get_student(student_id: int) -> dict:
    initialize_database()

    with closing(connect_database()) as connection:
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

        if not student:
            raise HTTPException(status_code=404, detail="Student not found.")

        training_days = connection.execute(
            """
            SELECT * FROM training_days
            WHERE student_id = ?
            ORDER BY training_date DESC, training_time DESC
            """,
            (student_id,),
        ).fetchall()

        payments = connection.execute(
            """
            SELECT * FROM payments
            WHERE student_id = ?
            ORDER BY payment_date DESC, created_at DESC
            """,
            (student_id,),
        ).fetchall()

        activity = connection.execute(
            """
            SELECT * FROM activity_log
            WHERE student_id = ?
            ORDER BY created_at DESC
            LIMIT 20
            """,
            (student_id,),
        ).fetchall()

    result = student_row_to_dict(student)
    result["training_days"] = [student_row_to_dict(row) for row in training_days]
    result["payments"] = [student_row_to_dict(row) for row in payments]
    result["activity_log"] = [student_row_to_dict(row) for row in activity]
    return result


def update_student(student_id: int, payload: StudentUpdate) -> dict:
    initialize_database()

    with closing(connect_database()) as connection:
        existing = connection.execute(
            "SELECT id, full_name FROM students WHERE id = ?",
            (student_id,),
        ).fetchone()

        if not existing:
            raise HTTPException(status_code=404, detail="Student not found.")

        try:
            connection.execute(
                """
                UPDATE students SET
                    full_name = ?,
                    phone = ?,
                    alternate_phone = ?,
                    email = ?,
                    address = ?,
                    date_of_birth = ?,
                    course_type = ?,
                    joining_date = ?,
                    status = ?,
                    total_fee_amount = ?,
                    learner_permit_number = ?,
                    learner_permit_expiry_date = ?,
                    license_number = ?,
                    notes = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
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
                    student_id,
                ),
            )
        except sqlite3.IntegrityError as error:
            if "students.phone" in str(error) or "UNIQUE" in str(error):
                raise HTTPException(
                    status_code=409,
                    detail="A student with this phone number already exists.",
                ) from error
            raise HTTPException(status_code=400, detail="Student data is invalid.") from error

        connection.execute(
            """
            INSERT INTO activity_log (student_id, activity_type, description)
            VALUES (?, ?, ?)
            """,
            (student_id, "student_updated", f"Student details updated: {payload.full_name}"),
        )
        connection.commit()

    return get_student(student_id)


def archive_student(student_id: int) -> dict:
    initialize_database()

    with closing(connect_database()) as connection:
        existing = connection.execute(
            "SELECT id, full_name, status FROM students WHERE id = ?",
            (student_id,),
        ).fetchone()

        if not existing:
            raise HTTPException(status_code=404, detail="Student not found.")

        if existing["status"] == "archived":
            raise HTTPException(status_code=409, detail="Student is already archived.")

        connection.execute(
            """
            UPDATE students
            SET status = 'archived', archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (student_id,),
        )
        connection.execute(
            """
            INSERT INTO activity_log (student_id, activity_type, description)
            VALUES (?, ?, ?)
            """,
            (student_id, "student_archived", f"Student archived: {existing['full_name']}"),
        )
        connection.commit()

    return get_student(student_id)
