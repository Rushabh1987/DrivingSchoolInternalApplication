import sqlite3

import pytest

from app.database import connect_database, initialize_database


def use_temp_database(monkeypatch: pytest.MonkeyPatch, tmp_path):
    database_file = tmp_path / "driving_school_test.db"
    monkeypatch.setenv("DRIVING_SCHOOL_DB_PATH", str(database_file))
    initialize_database()

    return database_file


def table_names(connection: sqlite3.Connection) -> set[str]:
    rows = connection.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table'"
    ).fetchall()

    return {row["name"] for row in rows}


def view_names(connection: sqlite3.Connection) -> set[str]:
    rows = connection.execute(
        "SELECT name FROM sqlite_master WHERE type = 'view'"
    ).fetchall()

    return {row["name"] for row in rows}


def create_student(connection: sqlite3.Connection) -> int:
    cursor = connection.execute(
        """
        INSERT INTO students (
            full_name,
            phone,
            course_type,
            joining_date,
            total_fee_amount
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        ("Test Student", "9999999999", "Car", "2026-05-19", 10000),
    )

    return int(cursor.lastrowid)


def test_initialize_database_creates_mvp_schema(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)

    with connect_database() as connection:
        assert {
            "activity_log",
            "app_metadata",
            "payments",
            "students",
            "training_days",
        }.issubset(table_names(connection))
        assert "student_payment_summary" in view_names(connection)


def test_student_payment_summary_calculates_balance(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)

    with connect_database() as connection:
        student_id = create_student(connection)
        connection.execute(
            """
            INSERT INTO payments (student_id, payment_date, amount, method)
            VALUES (?, ?, ?, ?)
            """,
            (student_id, "2026-05-19", 2500, "cash"),
        )

        summary = connection.execute(
            "SELECT * FROM student_payment_summary WHERE student_id = ?",
            (student_id,),
        ).fetchone()

        assert dict(summary) == {
            "student_id": student_id,
            "total_fee_amount": 10000,
            "paid_amount": 2500,
            "pending_amount": 7500,
        }


def test_duplicate_student_phone_is_rejected(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)

    with connect_database() as connection:
        create_student(connection)

        with pytest.raises(sqlite3.IntegrityError):
            create_student(connection)


def test_invalid_status_values_are_rejected(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)

    with connect_database() as connection:
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                """
                INSERT INTO students (
                    full_name,
                    phone,
                    course_type,
                    joining_date,
                    status
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                ("Bad Status", "8888888888", "Car", "2026-05-19", "deleted"),
            )


def test_training_days_require_existing_student(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)

    with connect_database() as connection:
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                """
                INSERT INTO training_days (student_id, training_date)
                VALUES (?, ?)
                """,
                (999, "2026-05-20"),
            )


def test_student_cascade_removes_training_days_and_payments(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)

    with connect_database() as connection:
        student_id = create_student(connection)
        connection.execute(
            """
            INSERT INTO training_days (student_id, training_date)
            VALUES (?, ?)
            """,
            (student_id, "2026-05-20"),
        )
        connection.execute(
            """
            INSERT INTO payments (student_id, payment_date, amount)
            VALUES (?, ?, ?)
            """,
            (student_id, "2026-05-19", 500),
        )

        connection.execute("DELETE FROM students WHERE id = ?", (student_id,))

        training_count = connection.execute(
            "SELECT COUNT(*) AS count FROM training_days"
        ).fetchone()["count"]
        payment_count = connection.execute(
            "SELECT COUNT(*) AS count FROM payments"
        ).fetchone()["count"]

        assert training_count == 0
        assert payment_count == 0


def test_health_endpoint_uses_database(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)

    from fastapi.testclient import TestClient

    from app.main import app

    response = TestClient(app).get("/health")

    assert response.status_code == 200
    assert response.json()["database"] == "ok"
