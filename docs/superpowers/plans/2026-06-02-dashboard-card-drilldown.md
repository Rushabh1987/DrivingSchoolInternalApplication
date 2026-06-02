# Dashboard Card Drill-Down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make dashboard stat cards clickable so clicking one expands an inline panel below showing the relevant filtered list of students or training sessions.

**Architecture:** All changes are frontend-only in `page.tsx`. `StatusCard` gains optional `onClick`/`isActive` props. `Dashboard` tracks `activeFilter` state and renders a new `DashboardFilterPanel` component between the stat cards and the existing grid. Data is already loaded — no new API calls needed.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4

---

### Task 1: Make StatusCard optionally clickable

**Files:**
- Modify: `frontend/src/app/page.tsx` — `StatusCard` function (lines 2559–2590)

- [ ] **Step 1: Replace the StatusCard function**

Find and replace the entire `StatusCard` function in `frontend/src/app/page.tsx`:

```tsx
function StatusCard({
  isActive = false,
  label,
  loading,
  onClick,
  subtext,
  tone = "default",
  value,
}: {
  isActive?: boolean;
  label: string;
  loading: boolean;
  onClick?: () => void;
  subtext?: string;
  tone?: "default" | "success" | "primary" | "danger";
  value?: number;
}) {
  const valueClassName =
    tone === "success"
      ? "text-[#2f9e44]"
      : tone === "primary"
        ? "text-[#2563eb]"
        : tone === "danger"
          ? "text-[#d64545]"
          : "";

  return (
    <div
      className={`rounded-lg border bg-white p-4 transition ${
        onClick ? "cursor-pointer hover:bg-[#f9fafb]" : ""
      } ${isActive ? "border-[#2563eb] ring-2 ring-[#2563eb]/20" : "border-[#d1d5db]"}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <p className="text-sm text-[#6b7280]">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${valueClassName}`}>
        {loading ? "-" : value}
      </p>
      {subtext ? <p className="mt-1 text-sm font-medium text-[#6b7280]">{subtext}</p> : null}
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```
cd frontend && npm run lint
```

Expected: no errors on StatusCard.

---

### Task 2: Add activeFilter state and wire up Dashboard cards

**Files:**
- Modify: `frontend/src/app/page.tsx` — `Dashboard` function (lines ~658–769)

- [ ] **Step 1: Add the DashboardFilter type near the top of the file (after the existing type definitions, around line 184)**

```tsx
type DashboardFilter = "total" | "active" | "training" | "pending";
```

- [ ] **Step 2: Add activeFilter state and handler inside the Dashboard function, after the existing useState declarations**

```tsx
const [activeFilter, setActiveFilter] = useState<DashboardFilter | null>(null);

function handleFilterClick(filter: DashboardFilter) {
  setActiveFilter((current) => (current === filter ? null : filter));
}
```

- [ ] **Step 3: Replace the four StatusCard usages in the Dashboard return JSX**

Find the `<section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">` block and replace its contents:

```tsx
<section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <StatusCard
    isActive={activeFilter === "total"}
    label="Total students"
    loading={!data}
    onClick={() => handleFilterClick("total")}
    value={data?.counts.totalStudents}
  />
  <StatusCard
    isActive={activeFilter === "active"}
    label="Active students"
    loading={!data}
    onClick={() => handleFilterClick("active")}
    tone="success"
    value={data?.counts.activeStudents}
  />
  <StatusCard
    isActive={activeFilter === "training"}
    label="Today's training"
    loading={!data}
    onClick={() => handleFilterClick("training")}
    tone="primary"
    value={data?.counts.todaysTraining}
  />
  <StatusCard
    isActive={activeFilter === "pending"}
    label="Pending fees"
    loading={!data}
    onClick={() => handleFilterClick("pending")}
    subtext={data ? formatCurrency(data.counts.pendingPaymentAmount) : undefined}
    tone="danger"
    value={data?.counts.pendingPayments}
  />
</section>
```

- [ ] **Step 4: Run TypeScript check**

```
cd frontend && npm run lint
```

Expected: no new errors.

---

### Task 3: Add DashboardFilterPanel component

**Files:**
- Modify: `frontend/src/app/page.tsx` — add new function after `Dashboard` function

- [ ] **Step 1: Add the DashboardFilterPanel function immediately after the closing brace of the `Dashboard` function**

```tsx
function DashboardFilterPanel({
  activeFilter,
  onDismiss,
  onViewStudent,
  students,
  todaysTraining,
}: {
  activeFilter: DashboardFilter;
  onDismiss: () => void;
  onViewStudent: (id: number) => void;
  students: StudentListItem[];
  todaysTraining: TrainingItem[];
}) {
  const filteredStudents =
    activeFilter === "total"
      ? students
      : activeFilter === "active"
        ? students.filter((s) => s.status === "active")
        : activeFilter === "pending"
          ? students.filter((s) => s.pending_amount > 0)
          : [];

  const heading =
    activeFilter === "total"
      ? "All Students"
      : activeFilter === "active"
        ? "Active Students"
        : activeFilter === "training"
          ? "Today's Training"
          : "Pending Fees";

  const count =
    activeFilter === "training" ? todaysTraining.length : filteredStudents.length;

  return (
    <section className="rounded-lg border border-[#2563eb] bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {heading}{" "}
          <span className="text-sm font-normal text-[#6b7280]">({count})</span>
        </h2>
        <button
          className="rounded-md border border-[#d1d5db] px-3 py-1.5 text-sm font-medium text-[#6b7280] transition hover:bg-[#f3f4f6]"
          onClick={onDismiss}
          type="button"
        >
          Dismiss
        </button>
      </div>

      <div className="mt-4">
        {activeFilter === "training" ? (
          todaysTraining.length === 0 ? (
            <p className="text-sm text-[#6b7280]">No training sessions scheduled for today.</p>
          ) : (
            <>
              {todaysTraining.length === 8 ? (
                <p className="mb-3 text-xs text-[#6b7280]">
                  Showing up to 8 sessions — check Reports for the full list.
                </p>
              ) : null}
              <div className="space-y-2">
                {todaysTraining.map((item) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-md border border-[#d1d5db] p-3"
                    key={item.id}
                  >
                    <div>
                      <p className="font-semibold">{item.student_name}</p>
                      <p className="text-sm text-[#6b7280]">
                        {item.training_time || "Time not set"}
                        {item.instructor_name ? ` — ${item.instructor_name}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <StatusBadge status={item.status} />
                      <button
                        className="rounded-md border border-[#d1d5db] px-3 py-1 text-xs font-semibold text-[#1f2937] transition hover:bg-[#f3f4f6]"
                        onClick={() => onViewStudent(item.student_id)}
                        type="button"
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )
        ) : filteredStudents.length === 0 ? (
          <p className="text-sm text-[#6b7280]">No students found.</p>
        ) : (
          <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
            {filteredStudents.map((student) => (
              <div
                className="flex items-center justify-between gap-3 rounded-md border border-[#d1d5db] p-3"
                key={student.id}
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{student.full_name}</p>
                  <p className="text-sm text-[#6b7280]">{student.phone}</p>
                  {student.pending_amount > 0 ? (
                    <p className="mt-1 text-sm text-[#d64545]">
                      Pending {formatCurrency(student.pending_amount)}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusBadge status={student.status} />
                  <button
                    className="rounded-md border border-[#d1d5db] px-3 py-1 text-xs font-semibold text-[#1f2937] transition hover:bg-[#f3f4f6]"
                    onClick={() => onViewStudent(student.id)}
                    type="button"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```
cd frontend && npm run lint
```

Expected: no errors.

---

### Task 4: Render DashboardFilterPanel in Dashboard

**Files:**
- Modify: `frontend/src/app/page.tsx` — `Dashboard` return JSX

- [ ] **Step 1: Insert the DashboardFilterPanel between the stat cards section and the grid section**

In the Dashboard return, after the closing `</section>` of the stat cards grid and before the `<section className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">` line, insert:

```tsx
{activeFilter !== null && !studentsLoading && data ? (
  <DashboardFilterPanel
    activeFilter={activeFilter}
    onDismiss={() => setActiveFilter(null)}
    onViewStudent={onViewStudent}
    students={students}
    todaysTraining={data.todaysTraining}
  />
) : null}
```

- [ ] **Step 2: Run lint to confirm no TypeScript errors**

```
cd frontend && npm run lint
```

Expected: passes cleanly.

- [ ] **Step 3: Start the dev server and manually verify**

```
cd frontend && npm run dev
```

Open http://localhost:3000. Check:
- All 4 cards show a pointer cursor on hover
- Clicking "Active Students" shows a panel with only active-status students
- Clicking the same card again dismisses the panel
- Clicking a different card switches to that filter
- "Dismiss" button closes the panel
- The active card has a blue border/ring
- Clicking "View" on a student row navigates to their profile

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/page.tsx docs/superpowers/specs/2026-06-02-dashboard-card-drilldown-design.md docs/superpowers/plans/2026-06-02-dashboard-card-drilldown.md
git commit -m "feat: clickable dashboard cards with inline drill-down panel"
```
