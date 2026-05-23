from contextlib import closing
from datetime import date, datetime
import os

import psycopg2
import psycopg2.extras


_SCHEMA_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS app_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        full_name TEXT NOT NULL CHECK (length(trim(full_name)) > 0),
        phone TEXT NOT NULL UNIQUE CHECK (length(trim(phone)) > 0),
        alternate_phone TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        address TEXT NOT NULL DEFAULT '',
        date_of_birth TEXT,
        course_type TEXT NOT NULL DEFAULT '',
        joining_date TEXT NOT NULL CHECK (length(trim(joining_date)) > 0),
        status TEXT NOT NULL DEFAULT 'active'
            CHECK (status IN ('active', 'paused', 'completed', 'archived')),
        total_fee_amount INTEGER NOT NULL DEFAULT 0 CHECK (total_fee_amount >= 0),
        learner_permit_number TEXT NOT NULL DEFAULT '',
        learner_permit_expiry_date TEXT,
        license_number TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        archived_at TIMESTAMPTZ
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS training_days (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL,
        training_date TEXT NOT NULL CHECK (length(trim(training_date)) > 0),
        training_time TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'planned'
            CHECK (status IN ('planned', 'completed', 'cancelled', 'missed')),
        instructor_name TEXT NOT NULL DEFAULT '',
        vehicle_number TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL,
        payment_date TEXT NOT NULL CHECK (length(trim(payment_date)) > 0),
        amount INTEGER NOT NULL CHECK (amount > 0),
        method TEXT NOT NULL DEFAULT 'cash'
            CHECK (method IN ('cash', 'upi', 'bank_transfer', 'card', 'cheque', 'other')),
        receipt_number TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY,
        student_id INTEGER,
        activity_type TEXT NOT NULL CHECK (length(trim(activity_type)) > 0),
        description TEXT NOT NULL CHECK (length(trim(description)) > 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_students_status ON students(status)",
    "CREATE INDEX IF NOT EXISTS idx_students_phone ON students(phone)",
    "CREATE INDEX IF NOT EXISTS idx_training_days_student_id ON training_days(student_id)",
    "CREATE INDEX IF NOT EXISTS idx_training_days_date ON training_days(training_date)",
    "CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id)",
    "CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date)",
    "CREATE INDEX IF NOT EXISTS idx_activity_log_student_id ON activity_log(student_id)",
    """
    CREATE OR REPLACE VIEW student_payment_summary AS
    SELECT
        students.id AS student_id,
        students.total_fee_amount AS total_fee_amount,
        COALESCE(SUM(payments.amount), 0) AS paid_amount,
        students.total_fee_amount - COALESCE(SUM(payments.amount), 0) AS pending_amount
    FROM students
    LEFT JOIN payments ON payments.student_id = students.id
    GROUP BY students.id
    """,
]


class _PGConnection:
    """Thin wrapper giving psycopg2 connection a sqlite3-like execute() interface."""

    def __init__(self, conn):
        self._conn = conn

    def execute(self, query: str, params=None):
        cursor = self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute(query, params)
        return cursor

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        return False


def row_to_dict(row) -> dict:
    result = dict(row)
    for key, value in result.items():
        if isinstance(value, datetime):
            result[key] = value.strftime("%Y-%m-%d %H:%M:%S")
        elif isinstance(value, date):
            result[key] = value.isoformat()
    return result


def database_url() -> str:
    url = os.getenv("DATABASE_URL", "")
    if not url:
        raise RuntimeError("DATABASE_URL environment variable is not set.")
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    return url


def connect_database() -> _PGConnection:
    return _PGConnection(psycopg2.connect(database_url()))


def initialize_database() -> None:
    with closing(connect_database()) as connection:
        for statement in _SCHEMA_STATEMENTS:
            connection.execute(statement)
        connection.commit()


def verify_database() -> bool:
    with closing(connect_database()) as connection:
        connection.execute("SELECT 1")
    return True
