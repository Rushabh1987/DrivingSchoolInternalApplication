"""
One-time script to import exported SQLite data into Supabase (PostgreSQL).

Usage:
    Set DATABASE_URL env var, then run:
    python import_data.py students_full_1.json students_full_2.json ...

Each JSON file should be the full student profile from /students/{id}
(containing training_days, payments, activity_log).
"""

import json
import os
import sys
from contextlib import closing

import psycopg2
import psycopg2.extras


def connect():
    url = os.environ["DATABASE_URL"]
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    return psycopg2.connect(url)


def import_student(cursor, student: dict) -> int:
    cursor.execute(
        """
        INSERT INTO students (
            full_name, phone, alternate_phone, email, address,
            date_of_birth, course_type, joining_date, status,
            total_fee_amount, learner_permit_number, learner_permit_expiry_date,
            license_number, notes, created_at, updated_at, archived_at
        ) VALUES (
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s, %s,
            %s, %s, %s, %s, %s
        )
        ON CONFLICT (phone) DO NOTHING
        RETURNING id
        """,
        (
            student["full_name"],
            student["phone"],
            student.get("alternate_phone", ""),
            student.get("email", ""),
            student.get("address", ""),
            student.get("date_of_birth"),
            student.get("course_type", ""),
            student["joining_date"],
            student.get("status", "active"),
            student.get("total_fee_amount", 0),
            student.get("learner_permit_number", ""),
            student.get("learner_permit_expiry_date"),
            student.get("license_number", ""),
            student.get("notes", ""),
            student.get("created_at"),
            student.get("updated_at"),
            student.get("archived_at"),
        ),
    )
    row = cursor.fetchone()
    if row is None:
        print(f"  Skipped (phone already exists): {student['full_name']} ({student['phone']})")
        return None
    return row["id"]


def import_training_days(cursor, new_student_id: int, training_days: list):
    for day in training_days:
        cursor.execute(
            """
            INSERT INTO training_days (
                student_id, training_date, training_time, status,
                instructor_name, vehicle_number, notes, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                new_student_id,
                day["training_date"],
                day.get("training_time", ""),
                day.get("status", "planned"),
                day.get("instructor_name", ""),
                day.get("vehicle_number", ""),
                day.get("notes", ""),
                day.get("created_at"),
                day.get("updated_at"),
            ),
        )


def import_payments(cursor, new_student_id: int, payments: list):
    for payment in payments:
        cursor.execute(
            """
            INSERT INTO payments (
                student_id, payment_date, amount, method,
                receipt_number, notes, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                new_student_id,
                payment["payment_date"],
                payment["amount"],
                payment.get("method", "cash"),
                payment.get("receipt_number", ""),
                payment.get("notes", ""),
                payment.get("created_at"),
            ),
        )


def main():
    if len(sys.argv) < 2:
        print("Usage: python import_data.py student1.json student2.json ...")
        sys.exit(1)

    files = sys.argv[1:]
    students = []
    for f in files:
        with open(f) as fh:
            students.append(json.load(fh))

    conn = connect()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    for student in students:
        print(f"Importing: {student['full_name']} ({student['phone']})")
        new_id = import_student(cursor, student)
        if new_id:
            training_days = student.get("training_days", [])
            payments = student.get("payments", [])
            import_training_days(cursor, new_id, training_days)
            import_payments(cursor, new_id, payments)
            print(f"  Imported with new id={new_id}, {len(training_days)} training days, {len(payments)} payments")

    conn.commit()
    cursor.close()
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
