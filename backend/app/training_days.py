from contextlib import closing
from typing import Literal

from fastapi import HTTPException
from pydantic import BaseModel, Field, field_validator

from .database import connect_database, row_to_dict

TrainingDayStatus = Literal["planned", "completed", "cancelled", "missed"]


class TrainingDayCreate(BaseModel):
    training_date: str = Field(min_length=1)
    training_time: str = ""
    status: TrainingDayStatus = "planned"
    instructor_name: str = ""

    @field_validator("training_date", "training_time", "instructor_name")
    @classmethod
    def trim_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("training_date")
    @classmethod
    def require_date(cls, value: str) -> str:
        if not value:
            raise ValueError("Training date is required.")
        return value



def create_training_day(student_id: int, payload: TrainingDayCreate) -> dict:
    with closing(connect_database()) as connection:
        student = connection.execute(
            "SELECT id, full_name FROM students WHERE id = %s",
            (student_id,),
        ).fetchone()

        if not student:
            raise HTTPException(status_code=404, detail="Student not found.")

        day_id = int(connection.execute(
            """
            INSERT INTO training_days (
                student_id, training_date, training_time, status,
                instructor_name
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                student_id,
                payload.training_date,
                payload.training_time,
                payload.status,
                payload.instructor_name,
            ),
        ).fetchone()["id"])

        connection.execute(
            """
            INSERT INTO activity_log (student_id, activity_type, description)
            VALUES (%s, %s, %s)
            """,
            (
                student_id,
                "training_day_added",
                f"Training day added: {payload.training_date} ({payload.status})",
            ),
        )

        day = connection.execute(
            "SELECT * FROM training_days WHERE id = %s",
            (day_id,),
        ).fetchone()
        connection.commit()

    return row_to_dict(day)


def update_training_day(day_id: int, payload: TrainingDayCreate) -> dict:
    with closing(connect_database()) as connection:
        existing = connection.execute(
            "SELECT id, student_id, training_date FROM training_days WHERE id = %s",
            (day_id,),
        ).fetchone()

        if not existing:
            raise HTTPException(status_code=404, detail="Training day not found.")

        connection.execute(
            """
            UPDATE training_days SET
                training_date = %s,
                training_time = %s,
                status = %s,
                instructor_name = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (
                payload.training_date,
                payload.training_time,
                payload.status,
                payload.instructor_name,
                day_id,
            ),
        )
        connection.execute(
            """
            INSERT INTO activity_log (student_id, activity_type, description)
            VALUES (%s, %s, %s)
            """,
            (
                existing["student_id"],
                "training_day_updated",
                f"Training day updated: {payload.training_date} ({payload.status})",
            ),
        )
        day = connection.execute(
            "SELECT * FROM training_days WHERE id = %s",
            (day_id,),
        ).fetchone()
        connection.commit()

    return row_to_dict(day)


def delete_training_day(day_id: int) -> None:
    with closing(connect_database()) as connection:
        existing = connection.execute(
            "SELECT id, student_id, training_date FROM training_days WHERE id = %s",
            (day_id,),
        ).fetchone()

        if not existing:
            raise HTTPException(status_code=404, detail="Training day not found.")

        connection.execute("DELETE FROM training_days WHERE id = %s", (day_id,))
        connection.execute(
            """
            INSERT INTO activity_log (student_id, activity_type, description)
            VALUES (%s, %s, %s)
            """,
            (
                existing["student_id"],
                "training_day_deleted",
                f"Training day removed: {existing['training_date']}",
            ),
        )
        connection.commit()
