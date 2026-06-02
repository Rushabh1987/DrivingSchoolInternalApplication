# Dashboard Card Drill-Down Design

**Date:** 2026-06-02

## Summary

Clicking a dashboard stat card expands an inline panel below the cards showing the filtered list of students or training sessions relevant to that card. Clicking the same card again dismisses the panel.

## Cards and their filtered views

| Card | Filter shown |
|---|---|
| Total Students | All non-archived students |
| Active Students | Students where `status === 'active'` |
| Today's Training | `todaysTraining` items from dashboard API (capped at 8 by backend) |
| Pending Fees | Students where `pending_amount > 0` |

## Architecture

### State
`Dashboard` component gets one new state variable:
```ts
activeFilter: null | "total" | "active" | "training" | "pending"
```
Clicking a card sets `activeFilter` to its key. Clicking the active card again sets it back to `null`.

### `StatusCard` changes
- Accept optional `onClick?: () => void` prop.
- When `onClick` is provided: pointer cursor, subtle hover highlight, visual "selected" ring when active.

### New `DashboardFilterPanel` component
- Rendered between the stat card row and the existing student list/quick-actions grid.
- Shows a heading ("Active Students — 12 results"), a dismiss button, and the filtered list.
- Student rows: name, phone, status badge, pending amount (if > 0), View button.
- Training rows: student name, time, status badge, instructor.
- The "View" button in student rows triggers `onViewStudent(id)` — same as the existing student list.

### Data flow
No new API calls. Uses data already fetched by `Dashboard`:
- `students: StudentListItem[]` — already loaded via `/students`
- `data.todaysTraining` — already in dashboard API response

## Edge cases
- Today's Training is backend-capped at 8 rows. Panel shows a note if count equals 8: "Showing up to 8 sessions — check Reports for the full list."
- Panel auto-closes if a different card is clicked (filter switches).
- No filter panel shown while data is still loading.

## No backend changes required.
