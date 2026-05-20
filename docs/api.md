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
- `phone`
- `course_type`
- `joining_date`

Optional request fields:

- `status`
- `alternate_phone`
- `email`
- `address`
- `date_of_birth`
- `total_fee_amount`
- `learner_permit_number`
- `learner_permit_expiry_date`
- `license_number`
- `notes`

Duplicate phone numbers return `409`.
