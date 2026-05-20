from fastapi.testclient import TestClient

from app.database import connect_database, initialize_database
from app.main import app


def use_temp_database(monkeypatch, tmp_path):
    database_file = tmp_path / "driving_school_students_test.db"
    monkeypatch.setenv("DRIVING_SCHOOL_DB_PATH", str(database_file))
    initialize_database()


def valid_student_payload() -> dict:
    return {
        "full_name": "Rushabh Pawar",
        "phone": "9876543210",
        "course_type": "Car",
        "joining_date": "2026-05-19",
        "status": "active",
        "alternate_phone": "9876500000",
        "email": "rushabh@example.com",
        "address": "Mumbai",
        "date_of_birth": "2000-01-01",
        "total_fee_amount": 15000,
        "learner_permit_number": "LL123",
        "learner_permit_expiry_date": "2026-12-31",
        "license_number": "",
        "notes": "Prefers morning training.",
    }


def test_register_student_saves_student_and_activity(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)

    response = TestClient(app).post("/students", json=valid_student_payload())

    assert response.status_code == 201
    student = response.json()
    assert student["id"] == 1
    assert student["full_name"] == "Rushabh Pawar"
    assert student["phone"] == "9876543210"
    assert student["paid_amount"] == 0
    assert student["pending_amount"] == 15000

    with connect_database() as connection:
        activity = connection.execute(
            "SELECT activity_type FROM activity_log WHERE student_id = ?",
            (student["id"],),
        ).fetchone()

    assert activity["activity_type"] == "student_created"


def test_register_student_rejects_duplicate_phone(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    assert client.post("/students", json=valid_student_payload()).status_code == 201
    response = client.post("/students", json=valid_student_payload())

    assert response.status_code == 409
    assert response.json()["detail"] == "A student with this phone number already exists."


def test_register_student_validates_required_fields(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    payload = valid_student_payload()
    payload["full_name"] = " "

    response = TestClient(app).post("/students", json=payload)

    assert response.status_code == 422


def test_register_student_rejects_negative_fee(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    payload = valid_student_payload()
    payload["total_fee_amount"] = -1

    response = TestClient(app).post("/students", json=payload)

    assert response.status_code == 422


def test_list_students_returns_registered_students(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    client.post("/students", json=valid_student_payload())
    response = client.get("/students")

    assert response.status_code == 200
    assert response.json()[0]["full_name"] == "Rushabh Pawar"
    assert response.json()[0]["pending_amount"] == 15000


def test_list_students_includes_next_training_date_field(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    client.post("/students", json=valid_student_payload())
    response = client.get("/students")

    assert "next_training_date" in response.json()[0]


def test_list_students_next_training_date_future_planned(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    client.post("/students", json=valid_student_payload())
    student_id = client.get("/students").json()[0]["id"]

    with connect_database() as connection:
        connection.execute(
            "INSERT INTO training_days (student_id, training_date, status) VALUES (?, '2099-12-31', 'planned')",
            (student_id,),
        )
        connection.commit()

    response = client.get("/students")
    assert response.json()[0]["next_training_date"] == "2099-12-31"


def test_list_students_next_training_date_null_when_no_future_planned(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    client.post("/students", json=valid_student_payload())
    student_id = client.get("/students").json()[0]["id"]

    with connect_database() as connection:
        connection.execute(
            "INSERT INTO training_days (student_id, training_date, status) VALUES (?, '2020-01-01', 'completed')",
            (student_id,),
        )
        connection.commit()

    response = client.get("/students")
    assert response.json()[0]["next_training_date"] is None


def test_list_students_next_training_date_excludes_non_planned(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    client.post("/students", json=valid_student_payload())
    student_id = client.get("/students").json()[0]["id"]

    with connect_database() as connection:
        connection.executemany(
            "INSERT INTO training_days (student_id, training_date, status) VALUES (?, '2099-06-01', ?)",
            [(student_id, "completed"), (student_id, "cancelled"), (student_id, "missed")],
        )
        connection.commit()

    response = client.get("/students")
    assert response.json()[0]["next_training_date"] is None


def test_list_students_excludes_archived_by_default(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    archived_payload = {**valid_student_payload(), "status": "archived"}
    client.post("/students", json=archived_payload)
    response = client.get("/students")

    assert response.json() == []


def test_list_students_filter_all_excludes_archived(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    archived_payload = {**valid_student_payload(), "status": "archived"}
    client.post("/students", json=archived_payload)
    response = client.get("/students?status=all")

    assert response.json() == []


def test_list_students_filter_by_status(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    client.post("/students", json=valid_student_payload())
    paused_payload = {**valid_student_payload(), "phone": "1111111111", "status": "paused"}
    client.post("/students", json=paused_payload)

    response = client.get("/students?status=active")
    assert len(response.json()) == 1
    assert response.json()[0]["status"] == "active"

    response = client.get("/students?status=paused")
    assert len(response.json()) == 1
    assert response.json()[0]["status"] == "paused"


def test_list_students_search_by_name(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    client.post("/students", json=valid_student_payload())
    another_payload = {**valid_student_payload(), "full_name": "Amit Shah", "phone": "1111111111"}
    client.post("/students", json=another_payload)

    response = client.get("/students?search=rushabh")
    assert len(response.json()) == 1
    assert response.json()[0]["full_name"] == "Rushabh Pawar"


def test_list_students_search_by_phone(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    client.post("/students", json=valid_student_payload())
    another_payload = {**valid_student_payload(), "full_name": "Amit Shah", "phone": "1111111111"}
    client.post("/students", json=another_payload)

    response = client.get("/students?search=111111")
    assert len(response.json()) == 1
    assert response.json()[0]["full_name"] == "Amit Shah"


def test_list_students_search_no_results(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    client.post("/students", json=valid_student_payload())
    response = client.get("/students?search=zzznomatch")

    assert response.json() == []


# --- Student detail, update, and archive ---

def test_get_student_returns_full_profile(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    created = client.post("/students", json=valid_student_payload()).json()
    response = client.get(f"/students/{created['id']}")

    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Rushabh Pawar"
    assert "training_days" in data
    assert "payments" in data
    assert "activity_log" in data


def test_get_student_not_found(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    response = TestClient(app).get("/students/9999")
    assert response.status_code == 404


def test_update_student(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    created = client.post("/students", json=valid_student_payload()).json()
    payload = {**valid_student_payload(), "full_name": "Rushabh Pawar Updated", "status": "completed"}
    response = client.put(f"/students/{created['id']}", json=payload)

    assert response.status_code == 200
    assert response.json()["full_name"] == "Rushabh Pawar Updated"
    assert response.json()["status"] == "completed"


def test_update_student_not_found(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    response = TestClient(app).put("/students/9999", json=valid_student_payload())
    assert response.status_code == 404


def test_archive_student(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    created = client.post("/students", json=valid_student_payload()).json()
    response = client.patch(f"/students/{created['id']}/archive")

    assert response.status_code == 200
    assert response.json()["status"] == "archived"


def test_archive_already_archived_returns_conflict(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    created = client.post("/students", json=valid_student_payload()).json()
    client.patch(f"/students/{created['id']}/archive")
    response = client.patch(f"/students/{created['id']}/archive")

    assert response.status_code == 409


def test_archived_student_hidden_from_default_list(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    created = client.post("/students", json=valid_student_payload()).json()
    client.patch(f"/students/{created['id']}/archive")

    assert client.get("/students").json() == []


def test_archived_student_visible_with_archived_filter(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    created = client.post("/students", json=valid_student_payload()).json()
    client.patch(f"/students/{created['id']}/archive")

    students = client.get("/students?status=archived").json()
    assert len(students) == 1
    assert students[0]["status"] == "archived"
