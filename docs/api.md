# API

## `GET /health`

Returns backend and database health.

## `GET /dashboard`

Returns dashboard data for the admin dashboard.

Response shape:

```json
{
  "date": "2026-05-19",
  "counts": {
    "totalStudents": 0,
    "activeStudents": 0,
    "todaysTraining": 0,
    "pendingPayments": 0,
    "pendingPaymentAmount": 0
  },
  "recentStudents": [],
  "todaysTraining": []
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
