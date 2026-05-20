from fastapi.testclient import TestClient

from app.main import app


def use_temp_database(monkeypatch, tmp_path):
    from app.database import initialize_database
    monkeypatch.setenv("DRIVING_SCHOOL_DB_PATH", str(tmp_path / "test.db"))
    initialize_database()


def create_student(client, phone="9876543210", status="active", total_fee=5000):
    return client.post("/students", json={
        "full_name": "Ravi Kumar",
        "phone": phone,
        "joining_date": "2024-01-15",
        "status": status,
        "total_fee_amount": total_fee,
    }).json()


def add_payment(client, student_id, amount, date="2024-02-01"):
    return client.post(f"/students/{student_id}/payments", json={
        "payment_date": date,
        "amount": amount,
        "method": "cash",
    }).json()


def add_training_day(client, student_id, date, status="planned"):
    return client.post(f"/students/{student_id}/training-days", json={
        "training_date": date,
        "status": status,
    }).json()


# --- Students report ---

def test_students_report_counts_by_status(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    create_student(client, phone="1111111111", status="active")
    create_student(client, phone="2222222222", status="active")
    create_student(client, phone="3333333333", status="paused")

    response = client.get("/reports/students")
    assert response.status_code == 200
    data = response.json()
    assert data["counts"]["active"] == 2
    assert data["counts"]["paused"] == 1
    assert data["total"] == 3


def test_students_report_filtered_by_status(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    create_student(client, phone="1111111111", status="active")
    create_student(client, phone="2222222222", status="paused")

    response = client.get("/reports/students?status=active")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["students"][0]["status"] == "active"


def test_students_report_includes_archived(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    student = create_student(client, phone="1111111111", status="active")
    client.patch(f"/students/{student['id']}/archive")

    response = client.get("/reports/students?status=archived")
    assert response.json()["total"] == 1


# --- Payments report ---

def test_payments_report_empty(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    response = TestClient(app).get("/reports/payments")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 0
    assert data["total_amount"] == 0


def test_payments_report_totals(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    student = create_student(client)
    add_payment(client, student["id"], 2000, "2024-02-01")
    add_payment(client, student["id"], 3000, "2024-03-01")

    response = client.get("/reports/payments")
    data = response.json()
    assert data["count"] == 2
    assert data["total_amount"] == 5000


def test_payments_report_date_filter(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    student = create_student(client)
    add_payment(client, student["id"], 1000, "2024-01-15")
    add_payment(client, student["id"], 2000, "2024-06-01")

    response = client.get("/reports/payments?from_date=2024-06-01&to_date=2024-12-31")
    data = response.json()
    assert data["count"] == 1
    assert data["total_amount"] == 2000


def test_payments_report_includes_student_name(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    student = create_student(client)
    add_payment(client, student["id"], 1000, "2024-02-01")

    data = client.get("/reports/payments").json()
    assert data["payments"][0]["full_name"] == "Ravi Kumar"


# --- Pending fees report ---

def test_pending_fees_report_empty_when_all_paid(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    student = create_student(client, total_fee=1000)
    add_payment(client, student["id"], 1000, "2024-02-01")

    response = client.get("/reports/pending-fees")
    assert response.json()["count"] == 0
    assert response.json()["total_pending"] == 0


def test_pending_fees_report_shows_outstanding(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    student = create_student(client, total_fee=5000)
    add_payment(client, student["id"], 2000, "2024-02-01")

    response = client.get("/reports/pending-fees")
    data = response.json()
    assert data["count"] == 1
    assert data["total_pending"] == 3000
    assert data["students"][0]["pending_amount"] == 3000


def test_pending_fees_report_excludes_archived(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    student = create_student(client, total_fee=5000)
    client.patch(f"/students/{student['id']}/archive")

    response = client.get("/reports/pending-fees")
    assert response.json()["count"] == 0


# --- Training days report ---

def test_training_days_report_empty(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    response = TestClient(app).get("/reports/training-days")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0


def test_training_days_report_counts_by_status(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    student = create_student(client)
    add_training_day(client, student["id"], "2024-02-01", "planned")
    add_training_day(client, student["id"], "2024-02-05", "completed")
    add_training_day(client, student["id"], "2024-02-10", "missed")

    response = client.get("/reports/training-days")
    data = response.json()
    assert data["total"] == 3
    assert data["counts"]["planned"] == 1
    assert data["counts"]["completed"] == 1
    assert data["counts"]["missed"] == 1


def test_training_days_report_date_filter(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    student = create_student(client)
    add_training_day(client, student["id"], "2024-01-10", "completed")
    add_training_day(client, student["id"], "2024-06-15", "planned")

    response = client.get("/reports/training-days?from_date=2024-06-01&to_date=2024-12-31")
    data = response.json()
    assert data["total"] == 1
    assert data["training_days"][0]["training_date"] == "2024-06-15"


# --- CSV exports ---

def test_students_csv_content_type(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    response = TestClient(app).get("/reports/students/csv")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]


def test_students_csv_has_header_row(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    response = TestClient(app).get("/reports/students/csv")
    first_line = response.text.splitlines()[0]
    assert "Name" in first_line
    assert "Phone" in first_line
    assert "Status" in first_line


def test_students_csv_contains_student_data(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    client = TestClient(app)

    create_student(client)
    response = client.get("/reports/students/csv")
    assert "Ravi Kumar" in response.text
    assert "9876543210" in response.text


def test_payments_csv_content_type(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    response = TestClient(app).get("/reports/payments/csv")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]


def test_payments_csv_has_header_row(monkeypatch, tmp_path):
    use_temp_database(monkeypatch, tmp_path)
    response = TestClient(app).get("/reports/payments/csv")
    first_line = response.text.splitlines()[0]
    assert "Amount" in first_line
    assert "Method" in first_line
