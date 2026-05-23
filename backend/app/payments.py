from contextlib import closing
from typing import Literal

from fastapi import HTTPException
from pydantic import BaseModel, Field, field_validator

from .database import connect_database, initialize_database, row_to_dict

PaymentMethod = Literal["cash", "upi", "bank_transfer", "card", "cheque", "other"]


class PaymentCreate(BaseModel):
    payment_date: str = Field(min_length=1)
    amount: int = Field(gt=0)
    method: PaymentMethod = "cash"
    receipt_number: str = ""
    notes: str = ""

    @field_validator("payment_date", "receipt_number", "notes")
    @classmethod
    def trim_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("payment_date")
    @classmethod
    def require_date(cls, value: str) -> str:
        if not value:
            raise ValueError("Payment date is required.")
        return value


def create_payment(student_id: int, payload: PaymentCreate) -> dict:
    initialize_database()

    with closing(connect_database()) as connection:
        student = connection.execute(
            "SELECT id FROM students WHERE id = %s",
            (student_id,),
        ).fetchone()

        if not student:
            raise HTTPException(status_code=404, detail="Student not found.")

        payment_id = int(connection.execute(
            """
            INSERT INTO payments (
                student_id, payment_date, amount, method,
                receipt_number, notes
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                student_id,
                payload.payment_date,
                payload.amount,
                payload.method,
                payload.receipt_number,
                payload.notes,
            ),
        ).fetchone()["id"])

        connection.execute(
            """
            INSERT INTO activity_log (student_id, activity_type, description)
            VALUES (%s, %s, %s)
            """,
            (
                student_id,
                "payment_added",
                f"Payment recorded: {payload.amount} via {payload.method} on {payload.payment_date}",
            ),
        )

        payment = connection.execute(
            "SELECT * FROM payments WHERE id = %s",
            (payment_id,),
        ).fetchone()
        connection.commit()

    return row_to_dict(payment)
