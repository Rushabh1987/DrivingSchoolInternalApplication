# QA Checklist

Manual testing checklist for the Driving School Admin app.
Run through this before each release on both laptop and mobile.

---

## Setup

- [ ] Backend running: `uv run uvicorn app.main:app --reload` (from `backend/`)
- [ ] Frontend running: `npm run dev` (from `frontend/`) — or use Docker build
- [ ] Open `http://localhost:3000` in browser
- [ ] Open browser DevTools > Device Toolbar for mobile testing (375px width)

---

## 1. Login

| Step | Expected | Laptop | Mobile |
|------|----------|--------|--------|
| Enter wrong username/password and submit | Error message shown | | |
| Enter correct credentials (admin / password) | Redirected to Dashboard | | |
| Close tab and reopen app | Redirected to Login (session expired) | | |
| Click Logout | Redirected to Login | | |

---

## 2. Navigation

| Step | Expected | Laptop | Mobile |
|------|----------|--------|--------|
| All nav links visible on laptop | Dashboard, Students, Add Student, Reports visible | | |
| Hamburger button visible on mobile | Three-line icon in top right | | |
| Tap hamburger on mobile | Dropdown opens with all nav items | | |
| Tap a nav item on mobile | Dropdown closes, correct view loads | | |

---

## 3. Dashboard

| Step | Expected | Laptop | Mobile |
|------|----------|--------|--------|
| Dashboard loads without errors | Stat cards, training panel, and recent students visible | | |
| Stat cards show correct data | Total, Active, Today's Training, Pending Fees reflect real data | | |
| Today's training list shows current students | Correct students and times displayed | | |
| "Add Student" quick action button works | Navigates to registration form | | |

---

## 4. Student Registration

| Step | Expected | Laptop | Mobile |
|------|----------|--------|--------|
| Submit form with no fields | Validation error shown | | |
| Submit with invalid phone (< 10 digits) | Validation error shown | | |
| Submit with all required fields | Student saved, redirected to dashboard with success message | | |
| Submit with a duplicate phone number | Conflict error shown | | |
| Form layout on mobile | Fields stack to single column, inputs are finger-sized | | |

---

## 5. Student List

| Step | Expected | Laptop | Mobile |
|------|----------|--------|--------|
| Students page loads | All non-archived students listed | | |
| Search by name (partial match) | List filters correctly | | |
| Search by phone | List filters correctly | | |
| Filter by Active / Paused / Completed | Only matching students shown | | |
| Laptop view | Table with columns visible | | |
| Mobile view | Compact cards (no table) | | |
| Click View on a student | Student profile opens | | |

---

## 6. Student Profile

| Step | Expected | Laptop | Mobile |
|------|----------|--------|--------|
| Profile loads with all sections | Personal details, fees, training days, payments, activity log | | |
| Fee summary (Total / Paid / Pending) | Correct amounts displayed | | |
| Edit student details | Form pre-filled, changes saved correctly | | |
| Change student status to Completed | Status badge updates | | |
| Archive student | Confirmation required, student hidden from default list | | |
| Archived student visible via Archived filter | Student appears in student list with Archived filter | | |

---

## 7. Training Days

| Step | Expected | Laptop | Mobile |
|------|----------|--------|--------|
| Add training day with date and status | Day appears in profile | | |
| Add training day without date | Validation error shown | | |
| Edit training day status to Completed | Status badge updates | | |
| Delete training day | Confirmation required, day removed | | |
| Future planned day shows in student list | "Next Training" column/card shows correct date | | |
| Today's planned day appears on dashboard | Dashboard training panel updated | | |

---

## 8. Payments

| Step | Expected | Laptop | Mobile |
|------|----------|--------|--------|
| Add payment with date and amount | Payment appears in history, pending amount reduces | | |
| Add payment with zero amount | Validation error shown | | |
| Add multiple payments | Paid amount accumulates correctly | | |
| Full payment made | Pending shows zero | | |
| Payment history on laptop | Table layout | | |
| Payment history on mobile | Card layout | | |

---

## 9. Reports

| Step | Expected | Laptop | Mobile |
|------|----------|--------|--------|
| Reports page loads | Four tabs visible: Students, Payments, Pending Fees, Training Days | | |
| Students tab — All filter | All students including archived shown with status counts | | |
| Students tab — Active filter | Only active students shown | | |
| Students tab — Export CSV | `students.csv` downloads with correct columns | | |
| Payments tab — default date range | Current month payments shown with total | | |
| Payments tab — change date range | List updates to match range | | |
| Payments tab — Export CSV | `payments.csv` downloads with correct columns | | |
| Pending Fees tab | Only students with outstanding balances shown, sorted by amount | | |
| Training Days tab — default date range | Current month training days shown with status counts | | |
| Training Days tab — change date range | List updates correctly | | |
| Reports tabs on mobile | Tabs scroll horizontally if needed, data shows as cards | | |

---

## 10. Build verification

```
# Frontend static build
cd frontend && npm run build

# Backend tests
cd backend && python -m pytest tests/ -v
```

Both must complete with no errors before release.
