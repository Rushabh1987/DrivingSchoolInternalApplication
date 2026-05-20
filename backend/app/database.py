from contextlib import closing
import os
import sqlite3
from pathlib import Path

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TEXT
);

CREATE TABLE IF NOT EXISTS training_days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    training_date TEXT NOT NULL CHECK (length(trim(training_date)) > 0),
    training_time TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'planned'
        CHECK (status IN ('planned', 'completed', 'cancelled', 'missed')),
    instructor_name TEXT NOT NULL DEFAULT '',
    vehicle_number TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    payment_date TEXT NOT NULL CHECK (length(trim(payment_date)) > 0),
    amount INTEGER NOT NULL CHECK (amount > 0),
    method TEXT NOT NULL DEFAULT 'cash'
        CHECK (method IN ('cash', 'upi', 'bank_transfer', 'card', 'cheque', 'other')),
    receipt_number TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    activity_type TEXT NOT NULL CHECK (length(trim(activity_type)) > 0),
    description TEXT NOT NULL CHECK (length(trim(description)) > 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_phone ON students(phone);
CREATE INDEX IF NOT EXISTS idx_training_days_student_id ON training_days(student_id);
CREATE INDEX IF NOT EXISTS idx_training_days_date ON training_days(training_date);
CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_activity_log_student_id ON activity_log(student_id);

CREATE VIEW IF NOT EXISTS student_payment_summary AS
SELECT
    students.id AS student_id,
    students.total_fee_amount AS total_fee_amount,
    COALESCE(SUM(payments.amount), 0) AS paid_amount,
    students.total_fee_amount - COALESCE(SUM(payments.amount), 0) AS pending_amount
FROM students
LEFT JOIN payments ON payments.student_id = students.id
GROUP BY students.id;
"""

# Removes the CHECK (length(trim(course_type)) > 0) constraint added in v1.
# SQLite requires recreating the table to drop a constraint.
# The view referencing students must be dropped first and recreated after.
_MIGRATION_V2_SQL = """
PRAGMA foreign_keys = OFF;
BEGIN;

DROP VIEW IF EXISTS student_payment_summary;

CREATE TABLE students_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TEXT
);

INSERT INTO students_new SELECT * FROM students;
DROP TABLE students;
ALTER TABLE students_new RENAME TO students;

CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_phone ON students(phone);

CREATE VIEW student_payment_summary AS
SELECT
    students.id AS student_id,
    students.total_fee_amount AS total_fee_amount,
    COALESCE(SUM(payments.amount), 0) AS paid_amount,
    students.total_fee_amount - COALESCE(SUM(payments.amount), 0) AS pending_amount
FROM students
LEFT JOIN payments ON payments.student_id = students.id
GROUP BY students.id;

UPDATE app_metadata SET value = '2' WHERE key = 'schema_version';

COMMIT;
PRAGMA foreign_keys = ON;
"""


def database_path() -> Path:
    configured_path = os.getenv("DRIVING_SCHOOL_DB_PATH")
    if configured_path:
        return Path(configured_path)

    return Path(__file__).resolve().parents[1] / "data" / "driving_school.db"


def connect_database() -> sqlite3.Connection:
    path = database_path()
    path.parent.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")

    return connection


def _apply_migration_v2(connection: sqlite3.Connection) -> None:
    schema_row = connection.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='students'"
    ).fetchone()

    needs_migration = (
        schema_row is not None
        and "CHECK (length(trim(course_type)) > 0)" in schema_row["sql"]
    )

    if needs_migration:
        connection.executescript(_MIGRATION_V2_SQL)
    else:
        connection.execute(
            "UPDATE app_metadata SET value = '2' WHERE key = 'schema_version'"
        )
        connection.commit()


def initialize_database() -> Path:
    path = database_path()
    path.parent.mkdir(parents=True, exist_ok=True)

    with closing(connect_database()) as connection:
        connection.executescript(SCHEMA_SQL)

        # INSERT OR IGNORE preserves the version set by migrations across restarts.
        connection.execute(
            "INSERT OR IGNORE INTO app_metadata (key, value) VALUES ('schema_version', '1')"
        )
        connection.execute(
            "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('schema_status', 'mvp_student_schema')"
        )
        connection.commit()

        version_row = connection.execute(
            "SELECT value FROM app_metadata WHERE key = 'schema_version'"
        ).fetchone()
        version = int(version_row["value"]) if version_row else 1

        if version < 2:
            _apply_migration_v2(connection)

    return path


def verify_database() -> bool:
    initialize_database()

    with closing(connect_database()) as connection:
        connection.execute("SELECT 1")

    return True
