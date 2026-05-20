from datetime import date

from app.dashboard import get_dashboard_data
from app.database import connect_database, initialize_database


def use_temp_database(monkeypatch, tmp_path):
    database_file = tmp_path / "driving_school_dashboard_test.db"
    monkeypatch.setenv("DRIVING_SCHOOL_DB_PATH", str(database_file))
    initialize_database()


def test_dashboard_returns_empty_state(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)

    data = get_dashboard_data(today=date(2026, 5, 19))

    assert data["date"] == "2026-05-19"
    assert data["counts"] == {
        "totalStudents": 0,
        "activeStudents": 0,
        "todaysTraining": 0,
        "pendingPayments": 0,
        "pendingPaymentAmount": 0,
    }
    assert data["recentStudents"] == []
    assert data["todaysTraining"] == []


def test_dashboard_returns_counts_and_lists(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)

    with connect_database() as connection:
        active_student_id = connection.execute(
            """
            INSERT INTO students (
                full_name,
                phone,
                course_type,
                joining_date,
                status,
                total_fee_amount
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            ("Active Student", "9000000001", "Car", "2026-05-01", "active", 10000),
        ).lastrowid
        paused_student_id = connection.execute(
            """
            INSERT INTO students (
                full_name,
                phone,
                course_type,
                joining_date,
                status,
                total_fee_amount
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            ("Paused Student", "9000000002", "Car", "2026-05-02", "paused", 5000),
        ).lastrowid
        connection.execute(
            """
            INSERT INTO students (
                full_name,
                phone,
                course_type,
                joining_date,
                status,
                total_fee_amount
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            ("Archived Student", "9000000003", "Car", "2026-05-03", "archived", 5000),
        )
        connection.execute(
            """
            INSERT INTO training_days (
                student_id,
                training_date,
                training_time,
                status,
                instructor_name,
                vehicle_number
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (active_student_id, "2026-05-19", "09:00", "planned", "Raj", "MH01AB1234"),
        )
        connection.execute(
            """
            INSERT INTO training_days (student_id, training_date, status)
            VALUES (?, ?, ?)
            """,
            (paused_student_id, "2026-05-20", "planned"),
        )
        connection.execute(
            """
            INSERT INTO payments (student_id, payment_date, amount, method)
            VALUES (?, ?, ?, ?)
            """,
            (active_student_id, "2026-05-10", 2500, "cash"),
        )

    data = get_dashboard_data(today=date(2026, 5, 19))

    assert data["counts"] == {
        "totalStudents": 2,
        "activeStudents": 1,
        "todaysTraining": 1,
        "pendingPayments": 2,
        "pendingPaymentAmount": 12500,
    }
    assert [student["full_name"] for student in data["recentStudents"]] == [
        "Paused Student",
        "Active Student",
    ]
    assert data["todaysTraining"] == [
        {
            "id": 1,
            "student_id": active_student_id,
            "student_name": "Active Student",
            "training_date": "2026-05-19",
            "training_time": "09:00",
            "status": "planned",
            "instructor_name": "Raj",
            "vehicle_number": "MH01AB1234",
            "notes": "",
        }
    ]
