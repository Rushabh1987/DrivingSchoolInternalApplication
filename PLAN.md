# High level steps for project

## Part 1: Plan

Goal: build a simple internal Driving School app where the admin can register students, manage student details, and update each student's training days from both mobile and laptop.

- [x] Confirm this is an admin-only internal app for now
- [x] Create `AGENTS.md` describing the simple app scope and project rules
- [x] Confirm the target architecture: Next.js frontend, FastAPI backend, SQLite database, and Docker container
- [x] Keep the first build focused on students, training days, payments, notes, and simple reports
- [x] Do not add theory classes, complex fleet management, advanced HR, or unnecessary modules
- [x] Keep documentation in `docs/`

Success criteria:

- Plan is simple enough to execute without overbuilding
- Each part has clear verification criteria
- `AGENTS.md` explains the final product scope
- The MVP can be used comfortably on mobile and laptop

## Part 2: Scaffolding

Goal: create the basic project structure and local development setup.

- [x] Create `frontend/` with Next.js and TypeScript
- [x] Create `backend/` with FastAPI and SQLite support
- [x] Create `docs/` for project notes
- [x] Create `scripts/` for starting and stopping the app on Windows, Mac, and Linux
- [x] Add Docker setup for local use
- [x] Add a backend health route
- [x] Add a simple frontend app shell

Success criteria:

- Frontend starts locally
- Backend starts locally
- `GET /health` returns a valid response
- Project structure is easy to understand

## Part 3: Admin sign in

Goal: add a basic login screen so only the admin can access the app.

- [x] Add login form
- [x] Use simple hardcoded credentials for MVP
- [x] Keep signed-in state locally
- [x] Expire the signed-in session after 12 hours
- [x] Require login again after closing the browser tab
- [x] Add logout support
- [x] Block student pages until admin is signed in

Success criteria:

- Invalid login is rejected
- Valid login opens the dashboard
- Logout returns to login screen
- Protected pages cannot be opened without login

## Part 4: Database design

Goal: design a small SQLite database for students and their training records.

- [x] Create students table
- [x] Store student name, phone, alternate phone, email, address, date of birth, course type, joining date, status, and notes
- [x] Store license/learner permit details if available
- [x] Store training days for each student
- [x] Store payment summary and payment history
- [x] Store simple activity history for important updates
- [x] Document the schema in `docs/database-schema.md`

Success criteria:

- Database can be created automatically if missing
- Student records can be saved and updated
- Training days can be linked to a student
- Payment records can be linked to a student

## Part 5: Dashboard

Goal: create a practical first screen for the admin.

- [x] Show total students
- [x] Show active students
- [x] Show today's training days
- [x] Show pending payments
- [x] Show recently added students
- [x] Add quick actions for adding student and updating training day
- [x] Make dashboard responsive for mobile and laptop

Success criteria:

- Dashboard gives a quick view of the school
- Admin can quickly reach student registration
- Admin can quickly see today's training list
- Layout works well on mobile and laptop

## Part 6: Student registration

Goal: allow the admin to add students into the database from the UI.

- [x] Create student registration form
- [x] Add required fields: name, phone, course type, joining date, and status
- [x] Add optional fields: email, alternate phone, address, date of birth, license details, notes, and fees
- [x] Validate required fields
- [x] Prevent obvious duplicate students by phone number
- [x] Save the student to SQLite through the backend API
- [x] Show success and error states clearly
- [x] Make the form easy to use on mobile

Success criteria:

- Admin can register a new student
- Student appears in student list after saving
- Required fields are validated
- Duplicate phone numbers are warned

## Part 7: Student list and search

Goal: make it easy to find and manage students.

- [x] Add student list page
- [x] Add search by name or phone number
- [x] Add filters for active, completed, paused, and all students
- [x] Show key details: name, phone, course, joining date, status, pending fees, and next training day
- [x] Add student detail link
- [x] Make the list responsive with a table on laptop and compact cards on mobile

Success criteria:

- Admin can find a student quickly
- Filters work correctly
- Mobile view is readable without horizontal scrolling
- Student detail page opens from the list

## Part 8: Student profile

Goal: show and update all important information for one student.

- [x] Show student personal details
- [x] Show course details
- [x] Show training days
- [x] Show payment summary
- [x] Show notes
- [x] Show simple activity history
- [x] Allow admin to edit student details
- [x] Allow admin to change student status
- [x] Allow admin to archive a student instead of deleting

Success criteria:

- Student profile shows all important data
- Admin can update student details
- Admin can change student status
- Archived students are hidden from active list but remain searchable

## Part 9: Training days

Goal: let the admin update each student's training days simply.

- [x] Add training day list on student profile
- [x] Add training day form with date, time, status, and instructor name
- [x] Support statuses: planned, completed, cancelled, and missed
- [x] Allow admin to edit or remove a training day
- [x] Show today's training days on dashboard
- [x] Show next training day in student list
- [x] Keep the workflow fast on mobile

Success criteria:

- Admin can add training days for a student
- Admin can update a training day after it happens
- Dashboard shows today's planned training days
- Student list shows the next upcoming training day

## Part 10: Payments

Goal: track student fees without making accounting complicated.

- [x] Store total fees for each student
- [x] Record payments with date, amount, method, and note
- [x] Calculate paid amount and pending amount
- [x] Show payment history on student profile
- [x] Show pending payments on dashboard
- [x] Allow simple receipt note or receipt number

Success criteria:

- Admin can add payment records
- Pending amount updates correctly
- Payment history remains visible
- Dashboard highlights students with pending fees

## Part 11: Simple reports

Goal: give the admin basic business visibility.

- [ ] Add students report by status
- [ ] Add payments report by date range
- [ ] Add pending fees report
- [ ] Add training days report by date range
- [ ] Add CSV export for students and payments

Success criteria:

- Reports load from real database data
- Date filters work
- CSV export works
- Reports are readable on laptop and usable on mobile

## Part 12: Responsive UI

Goal: make the app comfortable on both mobile and laptop.

- [ ] Use responsive navigation
- [ ] Use compact mobile cards for student lists
- [ ] Use wider tables only when there is enough screen space
- [ ] Keep forms easy to fill on a phone
- [ ] Make buttons large enough for touch
- [ ] Ensure text does not overlap or overflow
- [ ] Test key screens on mobile and laptop widths

Success criteria:

- Login, dashboard, student list, registration form, student profile, training days, and payments work on mobile
- Laptop layout uses space efficiently
- No important text or buttons overflow
- Main workflows can be completed with touch input

## Part 13: Testing and quality

Goal: keep the small app reliable.

- [ ] Add frontend tests for login, student form, student list, and training day UI
- [ ] Add backend tests for student, training day, and payment APIs
- [ ] Add end-to-end tests for registering a student and updating training days
- [ ] Add build verification
- [ ] Add a short manual QA checklist in `docs/qa-checklist.md`

Success criteria:

- Main workflows are tested
- Frontend build passes
- Backend tests pass
- Manual QA checklist covers mobile and laptop

## Part 14: Deployment

Goal: package the app for simple local use.

- [ ] Add production Docker build
- [ ] Add `.env.example`
- [ ] Add database initialization
- [ ] Add backup instructions
- [ ] Add start and stop scripts
- [ ] Document how to open the app from laptop and mobile on the same local network

Success criteria:

- App can run locally in production mode
- Database is created automatically
- Backup steps are documented
- Admin can access the app from laptop and mobile when on the same network
