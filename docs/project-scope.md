# Project Scope

## Goal

Build a simple internal Driving School app for the admin.

The app should let the admin register students, manage student details, update training days, track simple payments, and view useful daily information from both mobile and laptop.

## Confirmed MVP Scope

- Admin-only internal app
- Simple sign in for the first version
- Student registration from the UI
- Student records stored in SQLite
- Student list, search, filters, and profile page
- Training day tracking for each student
- Simple payment tracking
- Basic dashboard
- Simple reports and CSV export
- Responsive layout for mobile and laptop

## Not Included In MVP

- Theory classes
- Classroom management
- Student portal
- Public website
- Online booking
- Complex HR features
- Complex fleet management
- AI assistant
- Multi-branch management

## Technical Direction

- Frontend: Next.js with TypeScript
- Backend: Python FastAPI
- Database: SQLite
- Packaging: Docker
- Scripts: start and stop scripts for Windows, Mac, and Linux

## UI Direction

- First screen after login is the dashboard
- Forms should be easy to fill on a phone
- Student lists should use tables on laptop and compact cards on mobile
- Buttons should be large enough for touch
- Text should not overlap or overflow
- No marketing landing page
- No unnecessary decorative sections
