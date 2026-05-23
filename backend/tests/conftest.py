import pytest
from contextlib import closing
from fastapi.testclient import TestClient

from app.database import connect_database, initialize_database


@pytest.fixture(autouse=True)
def reset_database():
    initialize_database()
    with closing(connect_database()) as connection:
        connection.execute(
            "TRUNCATE students, training_days, payments, activity_log RESTART IDENTITY CASCADE"
        )
        connection.commit()
    yield


@pytest.fixture
def client():
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
