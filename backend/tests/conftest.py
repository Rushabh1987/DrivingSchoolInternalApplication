import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DRIVING_SCHOOL_DB_PATH", str(tmp_path / "test.db"))
    from app.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture
def sample_student():
    return {
        "full_name": "Ravi Kumar",
        "phone": "9876543210",
        "joining_date": "2024-01-15",
        "status": "active",
        "course_type": "LMV",
        "total_fee_amount": 5000,
    }


@pytest.fixture
def created_student(client, sample_student):
    response = client.post("/students", json=sample_student)
    assert response.status_code == 201
    return response.json()
