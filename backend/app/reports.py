from contextlib import closing
import csv
import io

from fastapi.responses import StreamingResponse

from .database import connect_database, initialize_database


def get_students_report(status: str | None = None) -> dict:
    initialize_database()

    conditions: list[str] = []
    params: list = []

    if status and status != "all":
        conditions.append("students.status = ?")
        params.append(status)

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    query = f"""
        SELECT
            students.id,
            students.full_name,
            students.phone,
            students.course_type,
            students.joining_date,
            students.status,
            student_payment_summary.total_fee_amount,
            student_payment_summary.paid_amount,
            student_payment_summary.pending_amount
        FROM students
        JOIN student_payment_summary ON student_payment_summary.student_id = students.id
        {where_clause}
        ORDER BY students.status, students.full_name
    """

    with closing(connect_database()) as connection:
        rows = connection.execute(query, params).fetchall()
        count_rows = connection.execute(
            "SELECT status, COUNT(*) as count FROM students GROUP BY status"
        ).fetchall()

    return {
        "students": [dict(row) for row in rows],
        "counts": {row["status"]: row["count"] for row in count_rows},
        "total": len(rows),
    }


def get_payments_report(from_date: str | None = None, to_date: str | None = None) -> dict:
    initialize_database()

    conditions: list[str] = []
    params: list = []

    if from_date:
        conditions.append("payments.payment_date >= ?")
        params.append(from_date)
    if to_date:
        conditions.append("payments.payment_date <= ?")
        params.append(to_date)

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    query = f"""
        SELECT
            payments.id,
            payments.payment_date,
            payments.amount,
            payments.method,
            payments.receipt_number,
            payments.notes,
            students.full_name,
            students.phone
        FROM payments
        JOIN students ON students.id = payments.student_id
        {where_clause}
        ORDER BY payments.payment_date DESC, payments.created_at DESC
    """

    with closing(connect_database()) as connection:
        rows = connection.execute(query, params).fetchall()

    payments = [dict(row) for row in rows]
    return {
        "payments": payments,
        "total_amount": sum(p["amount"] for p in payments),
        "count": len(payments),
    }


def get_pending_fees_report() -> dict:
    initialize_database()

    query = """
        SELECT
            students.id,
            students.full_name,
            students.phone,
            students.course_type,
            students.joining_date,
            students.status,
            student_payment_summary.total_fee_amount,
            student_payment_summary.paid_amount,
            student_payment_summary.pending_amount
        FROM students
        JOIN student_payment_summary ON student_payment_summary.student_id = students.id
        WHERE student_payment_summary.pending_amount > 0
          AND students.status != 'archived'
        ORDER BY student_payment_summary.pending_amount DESC
    """

    with closing(connect_database()) as connection:
        rows = connection.execute(query).fetchall()

    students = [dict(row) for row in rows]
    return {
        "students": students,
        "total_pending": sum(s["pending_amount"] for s in students),
        "count": len(students),
    }


def get_training_days_report(from_date: str | None = None, to_date: str | None = None) -> dict:
    initialize_database()

    conditions: list[str] = []
    params: list = []

    if from_date:
        conditions.append("training_days.training_date >= ?")
        params.append(from_date)
    if to_date:
        conditions.append("training_days.training_date <= ?")
        params.append(to_date)

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    query = f"""
        SELECT
            training_days.id,
            training_days.training_date,
            training_days.training_time,
            training_days.status,
            training_days.instructor_name,
            students.full_name,
            students.phone
        FROM training_days
        JOIN students ON students.id = training_days.student_id
        {where_clause}
        ORDER BY training_days.training_date DESC, training_days.training_time DESC
    """

    count_query = f"""
        SELECT status, COUNT(*) as count
        FROM training_days
        {where_clause}
        GROUP BY status
    """

    with closing(connect_database()) as connection:
        rows = connection.execute(query, params).fetchall()
        count_rows = connection.execute(count_query, params).fetchall()

    days = [dict(row) for row in rows]
    return {
        "training_days": days,
        "counts": {row["status"]: row["count"] for row in count_rows},
        "total": len(days),
    }


def export_students_csv(status: str | None = None) -> StreamingResponse:
    initialize_database()

    conditions: list[str] = []
    params: list = []

    if status and status != "all":
        conditions.append("students.status = ?")
        params.append(status)

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    query = f"""
        SELECT
            students.id,
            students.full_name,
            students.phone,
            students.joining_date,
            students.status,
            student_payment_summary.total_fee_amount,
            student_payment_summary.paid_amount,
            student_payment_summary.pending_amount,
            students.created_at
        FROM students
        JOIN student_payment_summary ON student_payment_summary.student_id = students.id
        {where_clause}
        ORDER BY students.full_name
    """

    with closing(connect_database()) as connection:
        rows = connection.execute(query, params).fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Name", "Phone", "Joining Date", "Status",
        "Total Fee", "Paid", "Pending", "Registered At",
    ])
    for row in rows:
        writer.writerow([
            row["id"], row["full_name"], row["phone"],
            row["joining_date"], row["status"],
            row["total_fee_amount"], row["paid_amount"], row["pending_amount"],
            row["created_at"],
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=students.csv"},
    )


def export_payments_csv(from_date: str | None = None, to_date: str | None = None) -> StreamingResponse:
    initialize_database()

    conditions: list[str] = []
    params: list = []

    if from_date:
        conditions.append("payments.payment_date >= ?")
        params.append(from_date)
    if to_date:
        conditions.append("payments.payment_date <= ?")
        params.append(to_date)

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    query = f"""
        SELECT
            payments.id,
            payments.payment_date,
            payments.amount,
            payments.method,
            payments.receipt_number,
            payments.notes,
            students.full_name,
            students.phone,
            payments.created_at
        FROM payments
        JOIN students ON students.id = payments.student_id
        {where_clause}
        ORDER BY payments.payment_date DESC, payments.created_at DESC
    """

    with closing(connect_database()) as connection:
        rows = connection.execute(query, params).fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Payment Date", "Amount", "Method", "Receipt Number",
        "Notes", "Student Name", "Student Phone", "Recorded At",
    ])
    for row in rows:
        writer.writerow([
            row["id"], row["payment_date"], row["amount"],
            row["method"], row["receipt_number"], row["notes"],
            row["full_name"], row["phone"], row["created_at"],
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=payments.csv"},
    )
