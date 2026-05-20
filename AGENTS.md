# The Driving School Internal Management web app

## Business Requirements

This project is building a simple internal Driving School Management App. Key features:

- Admin can sign in
- Admin can register a student from the UI
- Student data is saved in the database
- Admin can view, search, edit, archive, and manage students
- Admin can update each student's training days
- Admin can mark a training day as planned, completed, cancelled, or missed
- Admin can record simple payment details for each student
- Admin can see paid amount and pending amount
- Admin can add notes to a student profile
- Admin can see a dashboard with active students, today's training days, and pending fees
- Admin can export basic student and payment data
- The app must work well on both mobile and laptop

## Limitations

For the MVP, there will only be one admin user.

For the MVP, login can use simple hardcoded credentials. The database should still be designed so real users can be added later if needed.

For the MVP, the admin session should expire after 12 hours. Closing the browser tab should require signing in again.

For the MVP, there will be no theory classes, classroom management, student portal, advanced HR, or complicated fleet management.

For the MVP, training days only need to store date, time, status, instructor name, vehicle number, and notes.

For the MVP, payments should stay simple: total fees, paid amount, pending amount, payment history, method, and note.

For the MVP, this is an internal app first. It does not need online booking or public website pages.

## Technical Decisions

- NextJS frontend
- TypeScript for frontend code
- Python FastAPI backend, including serving the built NextJS site at `/`
- SQLite local database for the MVP, creating a new database if it does not exist
- Everything packaged into a Docker container
- Use `uv` as the package manager for Python in the Docker container
- Start and stop server scripts for Mac, PC, and Linux in `scripts/`
- Keep the backend API simple and easy to test
- Use server-side validation for student, training day, and payment updates
- Archive students instead of permanently deleting them
- Keep all app screens responsive for mobile and laptop

## Starting Point

This project currently starts from documentation only. `Test.md` is a sample `PLAN.md` from another project, and `Test2.md` is a sample `AGENTS.md` from another project.

There is no frontend, backend, database, Docker setup, or scripts folder yet. The first implementation step should be scaffolding the project structure.

## Product Modules

- Admin sign in
- Dashboard
- Student registration
- Student list and search
- Student profile
- Training days
- Payments
- Notes
- Simple reports
- Settings

## Student Fields

The student record form collects:

- Student name (required)
- Phone number (required, exactly 10 digits)
- Joining date (required)
- Status (required)
- Address
- Date of birth
- Total fees

The database also stores `course_type`, `alternate_phone`, `email`, `learner_permit_number`, `learner_permit_expiry_date`, `license_number`, and `notes` columns for future use, but these fields are not shown in the current admin UI forms.

Student status options:

- Active
- Paused
- Completed
- Archived

## Training Day Fields

Each training day should include:

- Student
- Date
- Time
- Status
- Instructor name
- Vehicle number
- Notes

Training day status options:

- Planned
- Completed
- Cancelled
- Missed

## Color Scheme

- Road Yellow: `#f5b700` - accents and schedule highlights
- Signal Green: `#2f9e44` - completed status and paid status
- Brake Red: `#d64545` - missed status, overdue fees, and errors
- Asphalt Navy: `#1f2937` - headings, navigation, and primary text
- Sky Blue: `#2563eb` - links and primary actions
- Light Gray: `#f3f4f6` - page backgrounds
- Border Gray: `#d1d5db` - borders and dividers
- Text Gray: `#6b7280` - labels and supporting text

## UI Requirements

- The app must be responsive for mobile and laptop
- The first screen after login should be the dashboard
- Use simple navigation with clear sections
- Use tables on laptop where useful
- Use compact cards on mobile instead of wide tables
- Forms should be easy to fill on a phone
- Buttons should be large enough for touch
- Text should never overlap or overflow its container
- Do not create a marketing landing page
- Do not add unnecessary decorative sections

## Coding standards

1. Use latest stable versions of libraries and idiomatic approaches as of today
2. Keep the app simple and practical
3. Do not over-engineer the app
4. Do not add features that are not needed for student management, training days, payments, or simple reports
5. Keep README minimal and useful
6. No emojis anywhere in project documentation or UI copy
7. When hitting issues, always identify root cause before trying a fix. Do not guess. Prove with evidence, then fix the root cause.
8. Do not remove or rewrite user-created work unless the user explicitly asks
9. Add tests for core flows: login, student registration, student editing, training day updates, and payments
10. Use backend validation for all writes
11. Keep financial changes traceable in the database
12. Prefer clear forms, lists, filters, and profile pages over complex dashboards

## Working documentation

All documents for planning and executing this project should be in the `docs/` directory.

Please review the `PLAN.md` document before proceeding with implementation work.

When implementation begins, create or update these documents as needed:

- `docs/database-schema.md`
- `docs/api.md`
- `docs/ui-flows.md`
- `docs/testing.md`
- `docs/deployment.md`
- `docs/qa-checklist.md`
