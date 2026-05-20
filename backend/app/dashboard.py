from contextlib import closing
from datetime import date
from sqlite3 import Row
from typing import Any

from .database import connect_database, initialize_database


def row_to_dict(row: Row) -> dict[str, Any]:
    return dict(row)


def get_dashboard_data(today: date | None = None) -> dict[str, Any]:
    initialize_database()
    selected_date = (today or date.today()).isoformat()

    with closing(connect_database()) as connection:
        total_students = connection.execute(
            """
            SELECT COUNT(*) AS count
            FROM students
            WHERE status != 'archived'
            """
        ).fetchone()["count"]
        active_students = connection.execute(
            """
            SELECT COUNT(*) AS count
            FROM students
            WHERE status = 'active'
            """
        ).fetchone()["count"]
        todays_training = connection.execute(
            """
            SELECT COUNT(*) AS count
            FROM training_days
            WHERE training_date = ?
            """,
            (selected_date,),
        ).fetchone()["count"]
        pending_payments = connection.execute(
            """
            SELECT
                COUNT(*) AS count,
                COALESCE(SUM(pending_amount), 0) AS total_amount
            FROM student_payment_summary
            JOIN students ON students.id = student_payment_summary.student_id
            WHERE students.status != 'archived'
                AND pending_amount > 0
            """
        ).fetchone()
        recent_students = connection.execute(
            """
            SELECT
                id,
                full_name,
                phone,
                course_type,
                joining_date,
                status,
                created_at
            FROM students
            WHERE status != 'archived'
            ORDER BY datetime(created_at) DESC, id DESC
            LIMIT 5
            """
        ).fetchall()
        todays_training_items = connection.execute(
            """
            SELECT
                training_days.id,
                training_days.student_id,
                students.full_name AS student_name,
                training_days.training_date,
                training_days.training_time,
                training_days.status,
                training_days.instructor_name,
                training_days.vehicle_number,
                training_days.notes
            FROM training_days
            JOIN students ON students.id = training_days.student_id
            WHERE training_days.training_date = ?
                AND students.status != 'archived'
            ORDER BY
                CASE WHEN training_days.training_time = '' THEN 1 ELSE 0 END,
                training_days.training_time,
                training_days.id
            LIMIT 8
            """,
            (selected_date,),
        ).fetchall()

    return {
        "date": selected_date,
        "counts": {
            "totalStudents": total_students,
            "activeStudents": active_students,
            "todaysTraining": todays_training,
            "pendingPayments": pending_payments["count"],
            "pendingPaymentAmount": pending_payments["total_amount"],
        },
        "recentStudents": [row_to_dict(row) for row in recent_students],
        "todaysTraining": [row_to_dict(row) for row in todays_training_items],
    }
