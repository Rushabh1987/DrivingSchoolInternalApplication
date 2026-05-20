from fastapi.testclient import TestClient

from app.database import initialize_database
from app.main import app


def test_dashboard_endpoint_returns_dashboard_data(monkeypatch, tmp_path):
    database_file = tmp_path / "driving_school_api_test.db"
    monkeypatch.setenv("DRIVING_SCHOOL_DB_PATH", str(database_file))
    initialize_database()

    response = TestClient(app).get("/dashboard")

    assert response.status_code == 200
    assert response.json()["counts"]["totalStudents"] == 0
