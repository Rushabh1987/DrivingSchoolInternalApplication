# Database Schema

## Goal

The MVP database stores the minimum data needed for the admin to manage students, training days, simple payments, and important activity history.

The database is SQLite and is created automatically by the backend if it does not exist.

## Tables

## `students`

Stores the main student profile.

Fields:

- `id` - primary key
- `id` - primary key
- `full_name` - required student name
- `phone` - required unique phone number, must be exactly 10 digits
- `alternate_phone` - not shown in current UI forms
- `email` - not shown in current UI forms
- `address` - optional address
- `date_of_birth` - optional date, stored as `YYYY-MM-DD`
- `course_type` - optional course name/type, not shown in current UI forms
- `joining_date` - required date, stored as `YYYY-MM-DD`
- `status` - `active`, `paused`, `completed`, or `archived`
- `total_fee_amount` - total course fees as a whole number
- `learner_permit_number` - not shown in current UI forms
- `learner_permit_expiry_date` - not shown in current UI forms
- `license_number` - not shown in current UI forms
- `notes` - not shown in current UI forms
- `created_at` - created timestamp
- `updated_at` - updated timestamp
- `archived_at` - timestamp for archived students

Rules:

- `phone` must be unique and exactly 10 digits
- `full_name`, `phone`, and `joining_date` are required
- Students should be archived instead of permanently deleted in normal app workflows

## `training_days`

Stores each training day linked to one student.

Fields:

- `id` - primary key
- `student_id` - required link to `students.id`
- `training_date` - required date, stored as `YYYY-MM-DD`
- `training_time` - optional time, stored as `HH:MM`
- `status` - `planned`, `completed`, `cancelled`, or `missed`
- `instructor_name` - optional instructor name
- `vehicle_number` - not shown in current UI forms
- `notes` - not shown in current UI forms
- `created_at` - created timestamp
- `updated_at` - updated timestamp

Rules:

- A training day must belong to a student
- Deleting a student record at database level deletes the linked training days, but the app should normally archive students instead

## `payments`

Stores simple payment history for each student.

Fields:

- `id` - primary key
- `student_id` - required link to `students.id`
- `payment_date` - required date, stored as `YYYY-MM-DD`
- `amount` - required payment amount as a whole number
- `method` - `cash`, `upi`, `bank_transfer`, `card`, `cheque`, or `other`
- `receipt_number` - optional receipt number or receipt note
- `notes` - optional payment note
- `created_at` - created timestamp

Rules:

- A payment must belong to a student
- Payment amount must be greater than zero
- Pending amount is calculated instead of manually stored

## `activity_log`

Stores a simple history of important updates.

Fields:

- `id` - primary key
- `student_id` - optional link to `students.id`
- `activity_type` - short action name, such as `student_created` or `payment_added`
- `description` - readable description of the action
- `created_at` - created timestamp

Rules:

- Activity history should be written for important student, training, payment, and status changes
- If a student is deleted at database level, the activity row remains with `student_id` set to `NULL`

## Views

## `student_payment_summary`

Calculates payment totals for each student.

Fields:

- `student_id`
- `total_fee_amount`
- `paid_amount`
- `pending_amount`

This keeps the app simple: payments are stored once in `payments`, and balance numbers are calculated from those records.

## Indexes

Indexes are added for common lookup paths:

- Student status
- Student phone
- Training day student
- Training day date
- Payment student
- Payment date
- Activity student

## Date And Amount Format

Dates should be stored as text in `YYYY-MM-DD` format.

Times should be stored as text in `HH:MM` format.

Amounts are stored as whole numbers for the MVP. The UI should label them clearly based on the school currency.
