from fastapi.testclient import TestClient

from app.main import app


def use_temp_database(monkeypatch, tmp_path):
    from app.database import initialize_database
    monkeypatch.setenv("DRIVING_SCHOOL_DB_PATH", str(tmp_path / "test.db"))
    initialize_database()


def create_student(client, total_fee=5000):
    return client.post("/students", json={
        "full_name": "Ravi Kumar",
        "phone": "9876543210",
        "joining_date": "2024-01-15",
        "status": "active",
        "total_fee_amount": total_fee,
    }).json()


def test_add_payment(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    student = create_student(client, total_fee=5000)
    response = client.post(f"/students/{student['id']}/payments", json={
        "payment_date": "2024-02-01",
        "amount": 2000,
        "method": "cash",
    })

    assert response.status_code == 201
    data = response.json()
    assert data["amount"] == 2000
    assert data["method"] == "cash"


def test_payment_reduces_pending_amount(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    student = create_student(client, total_fee=5000)
    client.post(f"/students/{student['id']}/payments", json={
        "payment_date": "2024-02-01",
        "amount": 2000,
        "method": "cash",
    })

    profile = client.get(f"/students/{student['id']}").json()
    assert profile["paid_amount"] == 2000
    assert profile["pending_amount"] == 3000


def test_multiple_payments_accumulate(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    student = create_student(client, total_fee=5000)
    client.post(f"/students/{student['id']}/payments", json={"payment_date": "2024-02-01", "amount": 2000, "method": "cash"})
    client.post(f"/students/{student['id']}/payments", json={"payment_date": "2024-03-01", "amount": 3000, "method": "upi"})

    profile = client.get(f"/students/{student['id']}").json()
    assert profile["paid_amount"] == 5000
    assert profile["pending_amount"] == 0
    assert len(profile["payments"]) == 2


def test_payment_zero_amount_rejected(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    student = create_student(client)
    response = client.post(f"/students/{student['id']}/payments", json={
        "payment_date": "2024-02-01",
        "amount": 0,
        "method": "cash",
    })

    assert response.status_code == 422


def test_payment_negative_amount_rejected(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    student = create_student(client)
    response = client.post(f"/students/{student['id']}/payments", json={
        "payment_date": "2024-02-01",
        "amount": -500,
        "method": "cash",
    })

    assert response.status_code == 422


def test_payment_missing_date_rejected(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    student = create_student(client)
    response = client.post(f"/students/{student['id']}/payments", json={
        "payment_date": "",
        "amount": 1000,
        "method": "cash",
    })

    assert response.status_code == 422


def test_payment_student_not_found(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    response = TestClient(app).post("/students/9999/payments", json={
        "payment_date": "2024-02-01",
        "amount": 1000,
        "method": "cash",
    })

    assert response.status_code == 404


def test_payment_appears_in_student_profile(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    student = create_student(client, total_fee=5000)
    client.post(f"/students/{student['id']}/payments", json={
        "payment_date": "2024-02-01",
        "amount": 1500,
        "method": "upi",
        "receipt_number": "REC001",
    })

    profile = client.get(f"/students/{student['id']}").json()
    assert len(profile["payments"]) == 1
    assert profile["payments"][0]["receipt_number"] == "REC001"
