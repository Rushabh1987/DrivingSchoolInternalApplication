from fastapi.testclient import TestClient

from app.main import app


def use_temp_database(monkeypatch, tmp_path):
    from app.database import initialize_database
    monkeypatch.setenv("DRIVING_SCHOOL_DB_PATH", str(tmp_path / "test.db"))
    initialize_database()


def create_student(client):
    return client.post("/students", json={
        "full_name": "Ravi Kumar",
        "phone": "9876543210",
        "joining_date": "2024-01-15",
        "status": "active",
        "course_type": "LMV",
        "total_fee_amount": 5000,
    }).json()


def test_add_training_day(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    student = create_student(client)
    response = client.post(f"/students/{student['id']}/training-days", json={
        "training_date": "2024-02-01",
        "training_time": "09:00",
        "status": "planned",
        "instructor_name": "Mr. Sharma",
    })

    assert response.status_code == 201
    data = response.json()
    assert data["training_date"] == "2024-02-01"
    assert data["status"] == "planned"
    assert data["instructor_name"] == "Mr. Sharma"


def test_add_training_day_missing_date(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    student = create_student(client)
    response = client.post(f"/students/{student['id']}/training-days", json={
        "training_date": "",
        "status": "planned",
    })

    assert response.status_code == 422


def test_add_training_day_student_not_found(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    response = TestClient(app).post("/students/9999/training-days", json={
        "training_date": "2024-02-01",
        "status": "planned",
    })

    assert response.status_code == 404


def test_add_training_day_appears_in_student_profile(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    student = create_student(client)
    client.post(f"/students/{student['id']}/training-days", json={
        "training_date": "2024-02-01",
        "status": "planned",
    })

    profile = client.get(f"/students/{student['id']}").json()
    assert len(profile["training_days"]) == 1
    assert profile["training_days"][0]["training_date"] == "2024-02-01"


def test_update_training_day_status(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    student = create_student(client)
    day = client.post(f"/students/{student['id']}/training-days", json={
        "training_date": "2024-02-01",
        "status": "planned",
    }).json()

    response = client.put(f"/training-days/{day['id']}", json={
        "training_date": "2024-02-01",
        "status": "completed",
        "instructor_name": "Mr. Sharma",
    })

    assert response.status_code == 200
    assert response.json()["status"] == "completed"


def test_update_training_day_not_found(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    response = TestClient(app).put("/training-days/9999", json={
        "training_date": "2024-02-01",
        "status": "completed",
    })

    assert response.status_code == 404


def test_delete_training_day(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    student = create_student(client)
    day = client.post(f"/students/{student['id']}/training-days", json={
        "training_date": "2024-02-01",
        "status": "planned",
    }).json()

    response = client.delete(f"/training-days/{day['id']}")
    assert response.status_code == 204

    profile = client.get(f"/students/{student['id']}").json()
    assert profile["training_days"] == []


def test_delete_training_day_not_found(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    response = TestClient(app).delete("/training-days/9999")
    assert response.status_code == 404
