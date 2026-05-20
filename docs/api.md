# API

## `GET /health`

Returns backend and database health.

## `GET /dashboard`

Returns dashboard data for the admin dashboard.

Response shape:

```json
{
  "date": "2026-05-20",
  "counts": {
    "totalStudents": 0,
    "activeStudents": 0,
    "todaysTraining": 0,
    "pendingPayments": 0,
    "pendingPaymentAmount": 0
  },
  "recentStudents": [
    {
      "id": 1,
      "full_name": "Student Name",
      "phone": "9876543210",
      "joining_date": "2026-05-20",
      "status": "active",
      "created_at": "2026-05-20 10:00:00"
    }
  ],
  "todaysTraining": [
    {
      "id": 1,
      "student_id": 1,
      "student_name": "Student Name",
      "training_date": "2026-05-20",
      "training_time": "10:00",
      "status": "planned",
      "instructor_name": "Instructor Name"
    }
  ]
}
```

## `GET /students`

Returns the current non-archived students in newest-first order.

## `POST /students`

Registers a new student.

Required request fields:

- `full_name`
- `phone` — must be exactly 10 digits
- `joining_date`

Optional request fields:

- `status` (default: `active`)
- `address`
- `date_of_birth`
- `total_fee_amount`
- `course_type`
- `alternate_phone`
- `email`
- `learner_permit_number`
- `learner_permit_expiry_date`
- `license_number`
- `notes`

Duplicate phone numbers return `409`. Invalid phone format returns `422`.

## `GET /students/{id}`

Returns full student profile including training days, payment history, and activity log.

Returns `404` if not found.

## `PUT /students/{id}`

Updates student details. Accepts the same fields as `POST /students`. Status must be `active`, `paused`, or `completed` — use the archive endpoint to archive.

Returns `404` if not found. Duplicate phone returns `409`.

## `PATCH /students/{id}/archive`

Archives the student (sets `status` to `archived` and records `archived_at`). No request body needed.

Returns `404` if not found. Returns `409` if already archived.

## `POST /students/{id}/training-days`

Adds a training day for a student.

Required request fields:

- `training_date` — `YYYY-MM-DD`

Optional request fields:

- `training_time` — `HH:MM`
- `status` — `planned`, `completed`, `cancelled`, or `missed` (default: `planned`)
- `instructor_name`

Returns the created training day with `201`. Returns `404` if the student is not found.

## `PUT /training-days/{id}`

Updates a training day. Accepts the same fields as `POST /students/{id}/training-days`.

Returns the updated training day. Returns `404` if not found.

## `DELETE /training-days/{id}`

Deletes a training day. Returns `204` on success. Returns `404` if not found.

## `POST /students/{id}/payments`

Records a payment for a student.

Required request fields:

- `payment_date` — `YYYY-MM-DD`
- `amount` — positive integer

Optional request fields:

- `method` — `cash`, `upi`, `bank_transfer`, `card`, `cheque`, or `other` (default: `cash`)
- `receipt_number`
- `notes`

Returns the created payment with `201`. Returns `404` if the student is not found.

Payments are append-only — existing payment rows are never edited or deleted.
