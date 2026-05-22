"use client";

import { FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

const SESSION_KEY = "driving-school-admin-session";
const ADMIN_USERNAME = process.env.NEXT_PUBLIC_ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "password";
const SESSION_TIMEOUT_MS = 12 * 60 * 60 * 1000;

const SESSION_CHANGE_EVENT = "driving-school-session-change";

type ViewName = "dashboard" | "add-student" | "students" | "student-profile" | "reports";

type StoredSession = {
  status: "signed-in";
  expiresAt: number;
};

type DashboardData = {
  date: string;
  counts: {
    totalStudents: number;
    activeStudents: number;
    todaysTraining: number;
    pendingPayments: number;
    pendingPaymentAmount: number;
  };
  recentStudents: RecentStudent[];
  todaysTraining: TrainingItem[];
};

type RecentStudent = {
  id: number;
  full_name: string;
  phone: string;
  course_type: string;
  joining_date: string;
  status: string;
  created_at: string;
};

type StudentListItem = {
  id: number;
  full_name: string;
  phone: string;
  course_type: string;
  joining_date: string;
  status: string;
  total_fee_amount: number;
  paid_amount: number;
  pending_amount: number;
  completed_training_days: number;
};

type TrainingItem = {
  id: number;
  student_id: number;
  student_name: string;
  training_date: string;
  training_time: string;
  status: string;
  instructor_name: string;
};

type TrainingDayItem = {
  id: number;
  student_id: number;
  training_date: string;
  training_time: string;
  status: string;
  instructor_name: string;
  created_at: string;
};

type PaymentRecord = {
  id: number;
  student_id: number;
  payment_date: string;
  amount: number;
  method: string;
  receipt_number: string;
  notes: string;
  created_at: string;
};

type ActivityLogItem = {
  id: number;
  student_id: number | null;
  activity_type: string;
  description: string;
  created_at: string;
};

type StudentDetail = {
  id: number;
  full_name: string;
  phone: string;
  alternate_phone: string;
  email: string;
  address: string;
  date_of_birth: string | null;
  course_type: string;
  joining_date: string;
  status: string;
  total_fee_amount: number;
  paid_amount: number;
  pending_amount: number;
  learner_permit_number: string;
  learner_permit_expiry_date: string | null;
  license_number: string;
  notes: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  training_days: TrainingDayItem[];
  payments: PaymentRecord[];
  activity_log: ActivityLogItem[];
};

type ProfileState =
  | { status: "loading" }
  | { status: "ready"; data: StudentDetail }
  | { status: "error"; message: string };

type ReportTab = "students" | "payments" | "pending-fees" | "training-days";

type StudentReportRow = {
  id: number;
  full_name: string;
  phone: string;
  course_type: string;
  joining_date: string;
  status: string;
  total_fee_amount: number;
  paid_amount: number;
  pending_amount: number;
};

type PaymentReportRow = {
  id: number;
  payment_date: string;
  amount: number;
  method: string;
  receipt_number: string;
  notes: string;
  full_name: string;
  phone: string;
};

type TrainingDayReportRow = {
  id: number;
  training_date: string;
  training_time: string;
  status: string;
  instructor_name: string;
  full_name: string;
  phone: string;
};

type StudentsReportData = {
  students: StudentReportRow[];
  counts: Record<string, number>;
  total: number;
};

type PaymentsReportData = {
  payments: PaymentReportRow[];
  total_amount: number;
  count: number;
};

type PendingFeesReportData = {
  students: StudentReportRow[];
  total_pending: number;
  count: number;
};

type TrainingDaysReportData = {
  training_days: TrainingDayReportRow[];
  counts: Record<string, number>;
  total: number;
};

type TrainingDayFormState = {
  training_date: string;
  training_time: string;
  status: "planned" | "completed" | "cancelled" | "missed";
  instructor_name: string;
};

const emptyTrainingDayForm: TrainingDayFormState = {
  training_date: "",
  training_time: "",
  status: "planned",
  instructor_name: "",
};

type PaymentFormState = {
  payment_date: string;
  amount: string;
  method: "cash" | "upi" | "bank_transfer" | "card" | "cheque" | "other";
  receipt_number: string;
  notes: string;
};

const emptyPaymentForm: PaymentFormState = {
  payment_date: "",
  amount: "",
  method: "cash",
  receipt_number: "",
  notes: "",
};

type DashboardState =
  | { status: "loading" }
  | { status: "ready"; data: DashboardData }
  | { status: "error"; message: string };

type StudentListState =
  | { status: "loading" }
  | { status: "ready"; students: StudentListItem[] }
  | { status: "error"; message: string };

type StudentFormState = {
  full_name: string;
  phone: string;
  course_type: string;
  joining_date: string;
  status: "active" | "paused" | "completed";
  total_fee_amount: string;
  alternate_phone: string;
  email: string;
  address: string;
  date_of_birth: string;
  learner_permit_number: string;
  learner_permit_expiry_date: string;
  license_number: string;
  notes: string;
};

const emptyStudentForm: StudentFormState = {
  full_name: "",
  phone: "",
  course_type: "",
  joining_date: new Date().toISOString().slice(0, 10),
  status: "active",
  total_fee_amount: "",
  alternate_phone: "",
  email: "",
  address: "",
  date_of_birth: "",
  learner_permit_number: "",
  learner_permit_expiry_date: "",
  license_number: "",
  notes: "",
};

function readStoredSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const storedValue = window.sessionStorage.getItem(SESSION_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    const session = JSON.parse(storedValue) as Partial<StoredSession>;

    if (session.status !== "signed-in" || typeof session.expiresAt !== "number") {
      return null;
    }

    return session as StoredSession;
  } catch {
    return null;
  }
}

function getSessionSnapshot() {
  const session = readStoredSession();

  return Boolean(session && session.expiresAt > Date.now());
}

function subscribeToSessionChanges(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(SESSION_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SESSION_CHANGE_EVENT, callback);
  };
}

function notifySessionChange() {
  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
}

function clearStoredSession() {
  window.sessionStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(SESSION_KEY);
}

function getApiBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  if (typeof window !== "undefined" && window.location.port === "3000") {
    return "http://127.0.0.1:8000";
  }

  return "";
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "INR",
  }).format(amount);
}

function formatDate(dateValue: string) {
  if (!dateValue) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${dateValue}T00:00:00`));
}

function formatTimestamp(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value.replace(" ", "T")));
}

function titleCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function Home() {
  const isSignedIn = useSyncExternalStore(
    subscribeToSessionChanges,
    getSessionSnapshot,
    () => false,
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSignedIn) {
      return;
    }

    const session = readStoredSession();
    const delay = Math.max(0, (session?.expiresAt ?? Date.now()) - Date.now());
    const timeoutId = window.setTimeout(() => {
      clearStoredSession();
      notifySessionChange();
    }, delay);

    return () => window.clearTimeout(timeoutId);
  }, [isSignedIn]);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (username.trim() === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const session: StoredSession = {
        status: "signed-in",
        expiresAt: Date.now() + SESSION_TIMEOUT_MS,
      };

      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      window.localStorage.removeItem(SESSION_KEY);
      setPassword("");
      setError("");
      notifySessionChange();
      return;
    }

    setError("Invalid username or password.");
  }

  function handleLogout() {
    clearStoredSession();
    setUsername("");
    setPassword("");
    setError("");
    notifySessionChange();
  }

  if (!isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3f4f6] px-4 py-8 text-[#1f2937]">
        <section className="w-full max-w-md rounded-lg border border-[#d1d5db] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Driving School Logo" className="h-12 w-auto" />
            <div>
              <p className="text-sm font-medium text-[#6b7280]">Driving School</p>
              <h1 className="mt-1 text-2xl font-semibold">Admin Sign In</h1>
            </div>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleLogin}>
            <InputField
              autoComplete="username"
              label="Username"
              name="username"
              onChange={setUsername}
              required
              value={username}
            />
            <InputField
              autoComplete="current-password"
              label="Password"
              name="password"
              onChange={setPassword}
              required
              type="password"
              value={password}
            />

            {error ? <Alert tone="danger">{error}</Alert> : null}

            <button
              className="min-h-11 w-full rounded-md bg-[#2563eb] px-4 py-2 text-base font-semibold text-white transition hover:bg-[#1d4ed8] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30"
              type="submit"
            >
              Sign In
            </button>
          </form>
        </section>
      </main>
    );
  }

  return <AdminApp onLogout={handleLogout} />;
}

function AdminApp({ onLogout }: { onLogout: () => void }) {
  const [view, setView] = useState<ViewName>("dashboard");
  const [dataVersion, setDataVersion] = useState(0);
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);

  function handleStudentCreated(studentName: string) {
    setSuccessMessage(`${studentName} registered successfully.`);
    setDataVersion((version) => version + 1);
    setView("dashboard");
  }

  function handleViewChange(nextView: ViewName) {
    setSuccessMessage("");
    setView(nextView);
  }

  function handleViewStudent(id: number) {
    setSelectedStudentId(id);
    setView("student-profile");
  }

  function handleStudentUpdated() {
    setDataVersion((version) => version + 1);
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-[#1f2937]">
      <AppHeader activeView={view} onLogout={onLogout} onViewChange={handleViewChange} />

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        {view === "dashboard" ? (
          <Dashboard
            onAddStudent={() => handleViewChange("add-student")}
            onViewStudent={handleViewStudent}
            refreshKey={dataVersion}
            successMessage={successMessage}
          />
        ) : null}

        {view === "add-student" ? (
          <StudentRegistrationForm
            onCancel={() => handleViewChange("dashboard")}
            onCreated={handleStudentCreated}
          />
        ) : null}

        {view === "students" ? (
          <StudentsView
            onAddStudent={() => handleViewChange("add-student")}
            onViewStudent={handleViewStudent}
            refreshKey={dataVersion}
          />
        ) : null}

        {view === "student-profile" ? (
          <StudentProfileView
            onBack={() => handleViewChange("students")}
            onStudentUpdated={handleStudentUpdated}
            studentId={selectedStudentId}
          />
        ) : null}

        {view === "reports" ? <ReportsView /> : null}
      </main>
    </div>
  );
}

function AppHeader({
  activeView,
  onLogout,
  onViewChange,
}: {
  activeView: ViewName;
  onLogout: () => void;
  onViewChange: (view: ViewName) => void;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navItems: { label: string; value: ViewName }[] = [
    { label: "Dashboard", value: "dashboard" },
    { label: "Students", value: "students" },
    { label: "Add Student", value: "add-student" },
    { label: "Reports", value: "reports" },
  ];

  function handleNavClick(view: ViewName) {
    onViewChange(view);
    setMobileNavOpen(false);
  }

  function handleLogout() {
    setMobileNavOpen(false);
    onLogout();
  }

  return (
    <header className="border-b border-[#d1d5db] bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <img src="/logo.png" alt="Driving School Logo" className="h-44 w-auto" />

        {/* Desktop nav */}
        <div className="hidden sm:flex sm:items-center sm:gap-3">
          <nav className="flex gap-2 text-sm font-medium">
            {navItems.map((item) => (
              <NavButton
                active={activeView === item.value}
                key={item.value}
                label={item.label}
                onClick={() => handleNavClick(item.value)}
              />
            ))}
          </nav>
          <button
            className="min-h-10 rounded-md border border-[#d1d5db] px-3 py-2 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f3f4f6]"
            onClick={handleLogout}
            type="button"
          >
            Logout
          </button>
        </div>

        {/* Mobile hamburger button */}
        <button
          aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-[#d1d5db] text-[#1f2937] transition hover:bg-[#f3f4f6] sm:hidden"
          onClick={() => setMobileNavOpen((open) => !open)}
          type="button"
        >
          {mobileNavOpen ? (
            <svg fill="none" height="20" stroke="currentColor" viewBox="0 0 24 24" width="20">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
            </svg>
          ) : (
            <svg fill="none" height="20" stroke="currentColor" viewBox="0 0 24 24" width="20">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile nav dropdown */}
      {mobileNavOpen ? (
        <div className="border-t border-[#d1d5db] sm:hidden">
          <nav className="flex flex-col px-2 py-2">
            {navItems.map((item) => (
              <button
                className={`rounded-md px-3 py-3 text-left text-sm font-medium transition ${
                  activeView === item.value
                    ? "bg-[#1f2937] text-white"
                    : "text-[#1f2937] hover:bg-[#f3f4f6]"
                }`}
                key={item.value}
                onClick={() => handleNavClick(item.value)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="border-t border-[#d1d5db] px-2 py-2">
            <button
              className="w-full rounded-md border border-[#d1d5db] px-3 py-3 text-left text-sm font-semibold text-[#1f2937] transition hover:bg-[#f3f4f6]"
              onClick={handleLogout}
              type="button"
            >
              Logout
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function NavButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded-md px-3 py-2 ${active ? "bg-[#1f2937] text-white" : "text-[#6b7280]"}`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function Dashboard({
  onAddStudent,
  onViewStudent,
  refreshKey,
  successMessage,
}: {
  onAddStudent: () => void;
  onViewStudent: (id: number) => void;
  refreshKey: number;
  successMessage: string;
}) {
  const [dashboardState, setDashboardState] = useState<DashboardState>({
    status: "loading",
  });
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    async function loadDashboard() {
      try {
        const response = await fetch(`${getApiBaseUrl()}/dashboard`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Dashboard request failed with ${response.status}`);
        }

        const data = (await response.json()) as DashboardData;

        if (!isCancelled) {
          setDashboardState({ status: "ready", data });
        }
      } catch {
        if (!isCancelled) {
          setDashboardState({
            status: "error",
            message: "Dashboard data is unavailable. Start the backend and refresh.",
          });
        }
      }
    }

    async function loadStudents() {
      if (!isCancelled) setStudentsLoading(true);
      try {
        const response = await fetch(`${getApiBaseUrl()}/students`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as StudentListItem[];
        if (!isCancelled) setStudents(data);
      } catch {
        // non-critical, dashboard still works
      } finally {
        if (!isCancelled) setStudentsLoading(false);
      }
    }

    void loadDashboard();
    void loadStudents();

    return () => {
      isCancelled = true;
    };
  }, [refreshKey]);

  const data = dashboardState.status === "ready" ? dashboardState.data : null;

  return (
    <>
      {successMessage ? <Alert tone="success">{successMessage}</Alert> : null}
      {dashboardState.status === "error" ? (
        <Alert tone="danger">{dashboardState.message}</Alert>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatusCard label="Total students" loading={!data} value={data?.counts.totalStudents} />
        <StatusCard
          label="Active students"
          loading={!data}
          tone="success"
          value={data?.counts.activeStudents}
        />
        <StatusCard
          label="Today's training"
          loading={!data}
          tone="primary"
          value={data?.counts.todaysTraining}
        />
        <StatusCard
          label="Pending fees"
          loading={!data}
          subtext={data ? formatCurrency(data.counts.pendingPaymentAmount) : undefined}
          tone="danger"
          value={data?.counts.pendingPayments}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <DashboardStudentList loading={studentsLoading} onViewStudent={onViewStudent} students={students} />

        <div className="flex flex-col gap-4">
          <QuickActions onAddStudent={onAddStudent} />
          <RecentStudents students={data?.recentStudents ?? []} loading={!data} />
        </div>
      </section>
    </>
  );
}

function StudentRegistrationForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (studentName: string) => void;
}) {
  const [form, setForm] = useState<StudentFormState>(emptyStudentForm);
  const [submitState, setSubmitState] = useState<
    { status: "idle" } | { status: "saving" } | { status: "error"; message: string }
  >({ status: "idle" });

  function updateField<K extends keyof StudentFormState>(field: K, value: StudentFormState[K]) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.full_name.trim() || !form.phone.trim() || !form.joining_date) {
      setSubmitState({ status: "error", message: "Name, phone, and joining date are required." });
      return;
    }

    if (!/^\d{10}$/.test(form.phone.trim())) {
      setSubmitState({ status: "error", message: "Phone number must be exactly 10 digits." });
      return;
    }

    const totalFeeAmount = Number(form.total_fee_amount || 0);

    if (Number.isNaN(totalFeeAmount) || totalFeeAmount < 0) {
      setSubmitState({ status: "error", message: "Total fees must be zero or more." });
      return;
    }

    setSubmitState({ status: "saving" });

    try {
      const response = await fetch(`${getApiBaseUrl()}/students`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          date_of_birth: form.date_of_birth || null,
          learner_permit_expiry_date: form.learner_permit_expiry_date || null,
          total_fee_amount: totalFeeAmount,
        }),
      });

      if (!response.ok) {
        let message = "Student could not be saved.";

        if (response.status === 409) {
          message = "A student with this phone number already exists.";
        } else if (response.status === 422) {
          message = "Please check required fields and try again.";
        }

        throw new Error(message);
      }

      const student = (await response.json()) as { full_name: string };
      setForm(emptyStudentForm);
      setSubmitState({ status: "idle" });
      onCreated(student.full_name);
    } catch (error) {
      setSubmitState({
        status: "error",
        message: error instanceof Error ? error.message : "Student could not be saved.",
      });
    }
  }

  return (
    <section className="rounded-lg border border-[#d1d5db] bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Register Student</h2>
          <p className="text-sm text-[#6b7280]">Add a new student to the database.</p>
        </div>
        <button
          className="min-h-10 rounded-md border border-[#d1d5db] px-3 py-2 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f3f4f6]"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>

      <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <InputField label="Student name" name="full_name" onChange={(value) => updateField("full_name", value)} required value={form.full_name} />
          <InputField label="Phone number" name="phone" onChange={(value) => updateField("phone", value)} placeholder="10-digit number" required value={form.phone} />
          <InputField label="Joining date" name="joining_date" onChange={(value) => updateField("joining_date", value)} required type="date" value={form.joining_date} />
          <SelectField label="Status" name="status" onChange={(value) => updateField("status", value as StudentFormState["status"])} value={form.status}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </SelectField>
          <InputField label="Total fees" name="total_fee_amount" onChange={(value) => updateField("total_fee_amount", value)} placeholder="0" type="number" value={form.total_fee_amount} />
          <InputField label="Date of birth" name="date_of_birth" onChange={(value) => updateField("date_of_birth", value)} type="date" value={form.date_of_birth} />
        </div>

        <TextareaField label="Address" name="address" onChange={(value) => updateField("address", value)} value={form.address} />

        {submitState.status === "error" ? <Alert tone="danger">{submitState.message}</Alert> : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            className="min-h-11 rounded-md border border-[#d1d5db] px-4 py-2 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f3f4f6]"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="min-h-11 rounded-md bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-70"
            disabled={submitState.status === "saving"}
            type="submit"
          >
            {submitState.status === "saving" ? "Saving..." : "Save Student"}
          </button>
        </div>
      </form>
    </section>
  );
}

type StatusFilter = "all" | "active" | "paused" | "completed";

function StudentsView({
  onAddStudent,
  onViewStudent,
  refreshKey,
}: {
  onAddStudent: () => void;
  onViewStudent: (id: number) => void;
  refreshKey: number;
}) {
  const [studentState, setStudentState] = useState<StudentListState>({ status: "loading" });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let isCancelled = false;

    async function loadStudents() {
      setStudentState({ status: "loading" });

      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (statusFilter !== "all") params.set("status", statusFilter);

        const response = await fetch(`${getApiBaseUrl()}/students?${params}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Student request failed with ${response.status}`);
        }

        const students = (await response.json()) as StudentListItem[];

        if (!isCancelled) {
          setStudentState({ status: "ready", students });
        }
      } catch {
        if (!isCancelled) {
          setStudentState({
            status: "error",
            message: "Students are unavailable. Start the backend and refresh.",
          });
        }
      }
    }

    void loadStudents();

    return () => {
      isCancelled = true;
    };
  }, [debouncedSearch, statusFilter, refreshKey]);

  const statusFilterOptions: { label: string; value: StatusFilter }[] = [
    { label: "All", value: "all" },
    { label: "Active", value: "active" },
    { label: "Paused", value: "paused" },
    { label: "Completed", value: "completed" },
  ];

  return (
    <section className="rounded-lg border border-[#d1d5db] bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Students</h2>
          <p className="text-sm text-[#6b7280]">Search, filter, and manage registered students.</p>
        </div>
        <button
          className="min-h-11 rounded-md bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
          onClick={onAddStudent}
          type="button"
        >
          Add Student
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto">
          {statusFilterOptions.map((option) => (
            <button
              className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${
                statusFilter === option.value
                  ? "bg-[#1f2937] text-white"
                  : "text-[#6b7280] hover:bg-[#f3f4f6]"
              }`}
              key={option.value}
              onClick={() => setStatusFilter(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>

        <input
          className="min-h-10 w-full rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 sm:max-w-64"
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          type="search"
          value={search}
        />
      </div>

      <div className="mt-5">
        {studentState.status === "loading" ? (
          <p className="text-sm text-[#6b7280]">Loading students...</p>
        ) : null}
        {studentState.status === "error" ? <Alert tone="danger">{studentState.message}</Alert> : null}
        {studentState.status === "ready" && studentState.students.length === 0 ? (
          <p className="rounded-md border border-dashed border-[#d1d5db] p-6 text-center text-sm text-[#6b7280]">
            {search || statusFilter !== "all" ? "No students match your search." : "No students added yet."}
          </p>
        ) : null}
        {studentState.status === "ready" && studentState.students.length > 0 ? (
          <StudentList onViewStudent={onViewStudent} students={studentState.students} />
        ) : null}
      </div>
    </section>
  );
}

function StudentList({
  onViewStudent,
  students,
}: {
  onViewStudent: (id: number) => void;
  students: StudentListItem[];
}) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[#d1d5db] text-[#6b7280]">
              <th className="py-3 pr-4 font-semibold">Name</th>
              <th className="py-3 pr-4 font-semibold">Phone</th>
              <th className="py-3 pr-4 font-semibold">Course</th>
              <th className="py-3 pr-4 font-semibold">Joining</th>
              <th className="py-3 pr-4 font-semibold">Pending</th>
              <th className="py-3 pr-4 font-semibold">Status</th>
              <th className="py-3 pr-4 font-semibold">Completed Days</th>
              <th className="py-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr className="border-b border-[#d1d5db]" key={student.id}>
                <td className="py-3 pr-4 font-semibold">{student.full_name}</td>
                <td className="py-3 pr-4 text-[#6b7280]">{student.phone}</td>
                <td className="py-3 pr-4 text-[#6b7280]">{student.course_type}</td>
                <td className="py-3 pr-4 text-[#6b7280]">{formatDate(student.joining_date)}</td>
                <td className="py-3 pr-4 text-[#6b7280]">{formatCurrency(student.pending_amount)}</td>
                <td className="py-3 pr-4">
                  <StatusBadge status={student.status} />
                </td>
                <td className="py-3 pr-4 text-[#6b7280]">{student.completed_training_days}</td>
                <td className="py-3">
                  <button
                    className="rounded-md border border-[#d1d5db] px-3 py-1.5 text-xs font-semibold text-[#1f2937] transition hover:bg-[#f3f4f6]"
                    onClick={() => onViewStudent(student.id)}
                    type="button"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {students.map((student) => (
          <div className="rounded-md border border-[#d1d5db] p-3" key={student.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{student.full_name}</p>
                <p className="text-sm text-[#6b7280]">{student.phone}</p>
              </div>
              <StatusBadge status={student.status} />
            </div>
            <p className="mt-2 text-sm text-[#6b7280]">
              {student.course_type} - Joined {formatDate(student.joining_date)}
            </p>
            <p className="mt-1 text-sm font-medium text-[#d64545]">
              Pending {formatCurrency(student.pending_amount)}
            </p>
            <p className="mt-1 text-sm text-[#6b7280]">
              Completed days: <span className="font-medium text-[#1f2937]">{student.completed_training_days}</span>
            </p>
            <div className="mt-3">
              <button
                className="min-h-9 w-full rounded-md border border-[#d1d5db] px-3 py-1.5 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f3f4f6]"
                onClick={() => onViewStudent(student.id)}
                type="button"
              >
                View Profile
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function StudentProfileView({
  onBack,
  onStudentUpdated,
  studentId,
}: {
  onBack: () => void;
  onStudentUpdated: () => void;
  studentId: number | null;
}) {
  const [profileState, setProfileState] = useState<ProfileState>({ status: "loading" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [editForm, setEditForm] = useState<StudentFormState>(emptyStudentForm);
  const [editState, setEditState] = useState<
    { status: "idle" } | { status: "saving" } | { status: "error"; message: string }
  >({ status: "idle" });
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [archiveSaving, setArchiveSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (studentId === null) return;
    let isCancelled = false;

    async function loadStudent() {
      setProfileState({ status: "loading" });
      setMode("view");
      setArchiveConfirm(false);
      setSuccessMessage("");
      try {
        const response = await fetch(`${getApiBaseUrl()}/students/${studentId}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const data = (await response.json()) as StudentDetail;
        if (!isCancelled) setProfileState({ status: "ready", data });
      } catch {
        if (!isCancelled) setProfileState({ status: "error", message: "Could not load student profile. Check that the backend is running." });
      }
    }

    void loadStudent();
    return () => { isCancelled = true; };
  }, [studentId, refreshKey]);

  function handleStartEdit() {
    if (profileState.status !== "ready") return;
    const d = profileState.data;
    setEditForm({
      full_name: d.full_name,
      phone: d.phone,
      course_type: d.course_type,
      joining_date: d.joining_date,
      status: (d.status === "archived" ? "active" : d.status) as StudentFormState["status"],
      total_fee_amount: d.total_fee_amount > 0 ? String(d.total_fee_amount) : "",
      alternate_phone: d.alternate_phone,
      email: d.email,
      address: d.address,
      date_of_birth: d.date_of_birth ?? "",
      learner_permit_number: d.learner_permit_number,
      learner_permit_expiry_date: d.learner_permit_expiry_date ?? "",
      license_number: d.license_number,
      notes: d.notes,
    });
    setEditState({ status: "idle" });
    setSuccessMessage("");
    setMode("edit");
  }

  function updateEditField<K extends keyof StudentFormState>(field: K, value: StudentFormState[K]) {
    setEditForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editForm.full_name.trim() || !editForm.phone.trim() || !editForm.joining_date) {
      setEditState({ status: "error", message: "Name, phone, and joining date are required." });
      return;
    }

    if (!/^\d{10}$/.test(editForm.phone.trim())) {
      setEditState({ status: "error", message: "Phone number must be exactly 10 digits." });
      return;
    }

    const totalFeeAmount = Number(editForm.total_fee_amount || 0);
    if (Number.isNaN(totalFeeAmount) || totalFeeAmount < 0) {
      setEditState({ status: "error", message: "Total fees must be zero or more." });
      return;
    }

    setEditState({ status: "saving" });

    try {
      const response = await fetch(`${getApiBaseUrl()}/students/${studentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          date_of_birth: editForm.date_of_birth || null,
          learner_permit_expiry_date: editForm.learner_permit_expiry_date || null,
          total_fee_amount: totalFeeAmount,
        }),
      });

      if (!response.ok) {
        let message = "Student could not be updated.";
        if (response.status === 409) message = "A student with this phone number already exists.";
        else if (response.status === 422) message = "Please check required fields and try again.";
        throw new Error(message);
      }

      const updated = (await response.json()) as StudentDetail;
      setProfileState({ status: "ready", data: updated });
      setEditState({ status: "idle" });
      setMode("view");
      setSuccessMessage("Student details saved.");
      onStudentUpdated();
    } catch (error) {
      setEditState({
        status: "error",
        message: error instanceof Error ? error.message : "Student could not be updated.",
      });
    }
  }

  async function handleArchive() {
    if (!archiveConfirm) {
      setArchiveConfirm(true);
      return;
    }

    setArchiveSaving(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/students/${studentId}/archive`, { method: "PATCH" });
      if (!response.ok) throw new Error("Archive failed.");
      onStudentUpdated();
      onBack();
    } catch {
      setArchiveSaving(false);
      setArchiveConfirm(false);
    }
  }

  if (profileState.status === "loading") {
    return (
      <section className="rounded-lg border border-[#d1d5db] bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Student Profile</h2>
          <button className="min-h-10 rounded-md border border-[#d1d5db] px-3 py-2 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f3f4f6]" onClick={onBack} type="button">Back</button>
        </div>
        <p className="mt-6 text-sm text-[#6b7280]">Loading student profile...</p>
      </section>
    );
  }

  if (profileState.status === "error") {
    return (
      <section className="rounded-lg border border-[#d1d5db] bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Student Profile</h2>
          <button className="min-h-10 rounded-md border border-[#d1d5db] px-3 py-2 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f3f4f6]" onClick={onBack} type="button">Back</button>
        </div>
        <Alert tone="danger">{profileState.message}</Alert>
      </section>
    );
  }

  const student = profileState.data;

  if (mode === "edit") {
    return (
      <section className="rounded-lg border border-[#d1d5db] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Edit Student</h2>
            <p className="text-sm text-[#6b7280]">{student.full_name}</p>
          </div>
          <button className="min-h-10 rounded-md border border-[#d1d5db] px-3 py-2 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f3f4f6]" onClick={() => setMode("view")} type="button">Cancel</button>
        </div>

        <form className="mt-5 grid gap-4" onSubmit={handleSaveEdit}>
          <div className="grid gap-4 md:grid-cols-2">
            <InputField label="Student name" name="full_name" onChange={(v) => updateEditField("full_name", v)} required value={editForm.full_name} />
            <InputField label="Phone number" name="phone" onChange={(v) => updateEditField("phone", v)} placeholder="10-digit number" required value={editForm.phone} />
            <InputField label="Joining date" name="joining_date" onChange={(v) => updateEditField("joining_date", v)} required type="date" value={editForm.joining_date} />
            <SelectField label="Status" name="status" onChange={(v) => updateEditField("status", v as StudentFormState["status"])} value={editForm.status}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </SelectField>
            <InputField label="Total fees" name="total_fee_amount" onChange={(v) => updateEditField("total_fee_amount", v)} placeholder="0" type="number" value={editForm.total_fee_amount} />
            <InputField label="Date of birth" name="date_of_birth" onChange={(v) => updateEditField("date_of_birth", v)} type="date" value={editForm.date_of_birth} />
          </div>

          <TextareaField label="Address" name="address" onChange={(v) => updateEditField("address", v)} value={editForm.address} />

          {editState.status === "error" ? <Alert tone="danger">{editState.message}</Alert> : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button className="min-h-11 rounded-md border border-[#d1d5db] px-4 py-2 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f3f4f6]" onClick={() => setMode("view")} type="button">Cancel</button>
            <button className="min-h-11 rounded-md bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-70" disabled={editState.status === "saving"} type="submit">
              {editState.status === "saving" ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {successMessage ? <Alert tone="success">{successMessage}</Alert> : null}

      <section className="rounded-lg border border-[#d1d5db] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <button className="mb-2 text-sm font-medium text-[#2563eb] hover:underline" onClick={onBack} type="button">
              Back to Students
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold">{student.full_name}</h2>
              <StatusBadge status={student.status} />
            </div>
            <p className="mt-1 text-sm text-[#6b7280]">Joined {formatDate(student.joining_date)}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {student.status !== "archived" ? (
              <>
                <button className="min-h-10 rounded-md border border-[#d1d5db] px-3 py-2 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f3f4f6]" onClick={handleStartEdit} type="button">Edit</button>
                {archiveConfirm ? (
                  <>
                    <button
                      className="min-h-10 rounded-md border border-[#d64545] bg-[#d64545]/10 px-3 py-2 text-sm font-semibold text-[#d64545] transition hover:bg-[#d64545]/20 disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={archiveSaving}
                      onClick={handleArchive}
                      type="button"
                    >
                      {archiveSaving ? "Archiving..." : "Confirm Archive"}
                    </button>
                    {!archiveSaving ? (
                      <button className="min-h-10 rounded-md border border-[#d1d5db] px-3 py-2 text-sm font-semibold text-[#6b7280] transition hover:bg-[#f3f4f6]" onClick={() => setArchiveConfirm(false)} type="button">Cancel</button>
                    ) : null}
                  </>
                ) : (
                  <button className="min-h-10 rounded-md border border-[#d1d5db] px-3 py-2 text-sm font-semibold text-[#6b7280] transition hover:bg-[#f3f4f6]" onClick={handleArchive} type="button">Archive</button>
                )}
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 rounded-md border border-[#d1d5db] bg-[#f3f4f6] p-3 text-center text-sm">
          <div>
            <p className="text-xs text-[#6b7280]">Total Fees</p>
            <p className="mt-0.5 font-semibold">{formatCurrency(student.total_fee_amount)}</p>
          </div>
          <div>
            <p className="text-xs text-[#6b7280]">Paid</p>
            <p className="mt-0.5 font-semibold text-[#2f9e44]">{formatCurrency(student.paid_amount)}</p>
          </div>
          <div>
            <p className="text-xs text-[#6b7280]">Pending</p>
            <p className={`mt-0.5 font-semibold ${student.pending_amount > 0 ? "text-[#d64545]" : "text-[#2f9e44]"}`}>
              {formatCurrency(student.pending_amount)}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[#d1d5db] bg-white p-4 sm:p-5">
        <h3 className="font-semibold">Personal Details</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <DetailRow label="Phone" value={student.phone} />
          <DetailRow label="Date of birth" value={student.date_of_birth ? formatDate(student.date_of_birth) : null} />
          <DetailRow label="Address" value={student.address} />
        </dl>
      </section>

      <TrainingDaysSection
        onMutated={() => {
          setRefreshKey((k) => k + 1);
          onStudentUpdated();
        }}
        studentId={student.id}
        trainingDays={student.training_days}
      />

      <PaymentsSection
        onMutated={() => {
          setRefreshKey((k) => k + 1);
          onStudentUpdated();
        }}
        payments={student.payments}
        studentId={student.id}
      />

      <section className="rounded-lg border border-[#d1d5db] bg-white p-4 sm:p-5">
        <h3 className="font-semibold">Activity Log</h3>
        <div className="mt-3">
          {student.activity_log.length === 0 ? (
            <p className="text-sm text-[#6b7280]">No activity recorded.</p>
          ) : (
            <div className="space-y-2">
              {student.activity_log.map((item) => (
                <div className="flex flex-col gap-0.5 border-b border-[#d1d5db] pb-2 last:border-0" key={item.id}>
                  <p className="text-sm">{item.description}</p>
                  <p className="text-xs text-[#6b7280]">{formatTimestamp(item.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function TrainingDayForm({
  form,
  onCancel,
  onChange,
  onSubmit,
  saveState,
  title,
}: {
  form: TrainingDayFormState;
  onCancel: () => void;
  onChange: <K extends keyof TrainingDayFormState>(field: K, value: TrainingDayFormState[K]) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  saveState: { status: "idle" } | { status: "saving" } | { status: "error"; message: string };
  title: string;
}) {
  return (
    <div className="rounded-md border border-[#d1d5db] bg-[#f3f4f6] p-4">
      <p className="mb-3 text-sm font-semibold">{title}</p>
      <form className="grid gap-3" onSubmit={onSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <InputField label="Date" name="training_date" onChange={(v) => onChange("training_date", v)} required type="date" value={form.training_date} />
          <InputField label="Time" name="training_time" onChange={(v) => onChange("training_time", v)} placeholder="HH:MM" type="time" value={form.training_time} />
          <SelectField label="Status" name="status" onChange={(v) => onChange("status", v as TrainingDayFormState["status"])} value={form.status}>
            <option value="planned">Planned</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="missed">Missed</option>
          </SelectField>
          <InputField label="Instructor name" name="instructor_name" onChange={(v) => onChange("instructor_name", v)} value={form.instructor_name} />
        </div>
        {saveState.status === "error" ? <Alert tone="danger">{saveState.message}</Alert> : null}
        <div className="flex gap-2">
          <button
            className="min-h-10 rounded-md bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-70"
            disabled={saveState.status === "saving"}
            type="submit"
          >
            {saveState.status === "saving" ? "Saving..." : "Save"}
          </button>
          <button
            className="min-h-10 rounded-md border border-[#d1d5db] px-4 py-2 text-sm font-semibold text-[#1f2937] transition hover:bg-white"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function TrainingDaysSection({
  onMutated,
  studentId,
  trainingDays,
}: {
  onMutated: () => void;
  studentId: number;
  trainingDays: TrainingDayItem[];
}) {
  type TdAction =
    | { type: "idle" }
    | { type: "adding" }
    | { type: "editing"; dayId: number }
    | { type: "deleting"; dayId: number };

  const [action, setAction] = useState<TdAction>({ type: "idle" });
  const [form, setForm] = useState<TrainingDayFormState>(emptyTrainingDayForm);
  const [saveState, setSaveState] = useState<
    { status: "idle" } | { status: "saving" } | { status: "error"; message: string }
  >({ status: "idle" });
  const [deleteSaving, setDeleteSaving] = useState(false);

  function updateField<K extends keyof TrainingDayFormState>(field: K, value: TrainingDayFormState[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function startAdd() {
    setForm({ ...emptyTrainingDayForm, training_date: new Date().toISOString().slice(0, 10) });
    setSaveState({ status: "idle" });
    setAction({ type: "adding" });
  }

  function startEdit(day: TrainingDayItem) {
    setForm({
      training_date: day.training_date,
      training_time: day.training_time,
      status: day.status as TrainingDayFormState["status"],
      instructor_name: day.instructor_name,
    });
    setSaveState({ status: "idle" });
    setAction({ type: "editing", dayId: day.id });
  }

  function cancel() {
    setAction({ type: "idle" });
    setSaveState({ status: "idle" });
  }

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.training_date) {
      setSaveState({ status: "error", message: "Training date is required." });
      return;
    }
    setSaveState({ status: "saving" });
    try {
      const response = await fetch(`${getApiBaseUrl()}/students/${studentId}/training-days`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error("Could not add training day.");
      setAction({ type: "idle" });
      setSaveState({ status: "idle" });
      onMutated();
    } catch (error) {
      setSaveState({ status: "error", message: error instanceof Error ? error.message : "Could not add training day." });
    }
  }

  async function handleEdit(e: FormEvent<HTMLFormElement>, dayId: number) {
    e.preventDefault();
    if (!form.training_date) {
      setSaveState({ status: "error", message: "Training date is required." });
      return;
    }
    setSaveState({ status: "saving" });
    try {
      const response = await fetch(`${getApiBaseUrl()}/training-days/${dayId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error("Could not update training day.");
      setAction({ type: "idle" });
      setSaveState({ status: "idle" });
      onMutated();
    } catch (error) {
      setSaveState({ status: "error", message: error instanceof Error ? error.message : "Could not update training day." });
    }
  }

  async function handleDelete(dayId: number) {
    setDeleteSaving(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/training-days/${dayId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete training day.");
      setAction({ type: "idle" });
      onMutated();
    } catch {
      setAction({ type: "idle" });
    } finally {
      setDeleteSaving(false);
    }
  }

  const isAdding = action.type === "adding";
  const editingId = action.type === "editing" ? action.dayId : null;
  const deletingId = action.type === "deleting" ? action.dayId : null;

  return (
    <section className="rounded-lg border border-[#d1d5db] bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">
          Training Days <span className="text-sm font-normal text-[#6b7280]">({trainingDays.length})</span>
        </h3>
        {!isAdding && editingId === null ? (
          <button
            className="min-h-9 rounded-md bg-[#2563eb] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
            onClick={startAdd}
            type="button"
          >
            Add Training Day
          </button>
        ) : null}
      </div>

      {isAdding ? (
        <div className="mt-3">
          <TrainingDayForm
            form={form}
            onCancel={cancel}
            onChange={updateField}
            onSubmit={handleAdd}
            saveState={saveState}
            title="New Training Day"
          />
        </div>
      ) : null}

      {editingId !== null ? (
        <div className="mt-3">
          <TrainingDayForm
            form={form}
            onCancel={cancel}
            onChange={updateField}
            onSubmit={(e) => handleEdit(e, editingId)}
            saveState={saveState}
            title="Edit Training Day"
          />
        </div>
      ) : null}

      <div className="mt-3">
        {trainingDays.length === 0 && !isAdding ? (
          <p className="rounded-md border border-dashed border-[#d1d5db] p-4 text-center text-sm text-[#6b7280]">
            No training days scheduled.
          </p>
        ) : trainingDays.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#d1d5db] text-[#6b7280]">
                    <th className="py-2 pr-3 font-semibold">Date</th>
                    <th className="py-2 pr-3 font-semibold">Time</th>
                    <th className="py-2 pr-3 font-semibold">Status</th>
                    <th className="py-2 pr-3 font-semibold">Instructor</th>
                    <th className="py-2 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {trainingDays.map((day) => (
                    <tr className="border-b border-[#d1d5db]" key={day.id}>
                      <td className="py-2 pr-3">{formatDate(day.training_date)}</td>
                      <td className="py-2 pr-3 text-[#6b7280]">{day.training_time || "-"}</td>
                      <td className="py-2 pr-3"><StatusBadge status={day.status} /></td>
                      <td className="py-2 pr-3 text-[#6b7280]">{day.instructor_name || "-"}</td>
                      <td className="py-2">
                        <div className="flex gap-1.5">
                          {deletingId === day.id ? (
                            <>
                              <button
                                className="rounded-md border border-[#d64545] bg-[#d64545]/10 px-2 py-1 text-xs font-semibold text-[#d64545] transition hover:bg-[#d64545]/20 disabled:cursor-not-allowed disabled:opacity-70"
                                disabled={deleteSaving}
                                onClick={() => handleDelete(day.id)}
                                type="button"
                              >
                                {deleteSaving ? "..." : "Confirm"}
                              </button>
                              <button
                                className="rounded-md border border-[#d1d5db] px-2 py-1 text-xs font-semibold text-[#6b7280] transition hover:bg-[#f3f4f6]"
                                onClick={cancel}
                                type="button"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="rounded-md border border-[#d1d5db] px-2 py-1 text-xs font-semibold text-[#1f2937] transition hover:bg-[#f3f4f6]"
                                onClick={() => startEdit(day)}
                                type="button"
                              >
                                Edit
                              </button>
                              <button
                                className="rounded-md border border-[#d1d5db] px-2 py-1 text-xs font-semibold text-[#6b7280] transition hover:bg-[#f3f4f6]"
                                onClick={() => setAction({ type: "deleting", dayId: day.id })}
                                type="button"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 md:hidden">
              {trainingDays.map((day) => (
                <div className="rounded-md border border-[#d1d5db] p-3" key={day.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{formatDate(day.training_date)}</p>
                      <p className="mt-0.5 text-sm text-[#6b7280]">
                        {day.training_time || "Time not set"}
                        {day.instructor_name ? ` - ${day.instructor_name}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={day.status} />
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    {deletingId === day.id ? (
                      <>
                        <button
                          className="min-h-9 flex-1 rounded-md border border-[#d64545] bg-[#d64545]/10 px-3 py-1.5 text-sm font-semibold text-[#d64545] transition hover:bg-[#d64545]/20 disabled:cursor-not-allowed disabled:opacity-70"
                          disabled={deleteSaving}
                          onClick={() => handleDelete(day.id)}
                          type="button"
                        >
                          {deleteSaving ? "Deleting..." : "Confirm Delete"}
                        </button>
                        <button
                          className="min-h-9 rounded-md border border-[#d1d5db] px-3 py-1.5 text-sm font-semibold text-[#6b7280] transition hover:bg-[#f3f4f6]"
                          onClick={cancel}
                          type="button"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="min-h-9 flex-1 rounded-md border border-[#d1d5db] px-3 py-1.5 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f3f4f6]"
                          onClick={() => startEdit(day)}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          className="min-h-9 rounded-md border border-[#d1d5db] px-3 py-1.5 text-sm font-semibold text-[#6b7280] transition hover:bg-[#f3f4f6]"
                          onClick={() => setAction({ type: "deleting", dayId: day.id })}
                          type="button"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function PaymentForm({
  form,
  onCancel,
  onChange,
  onSubmit,
  saving,
  error,
}: {
  form: PaymentFormState;
  onCancel: () => void;
  onChange: <K extends keyof PaymentFormState>(field: K, value: PaymentFormState[K]) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  error: string | null;
}) {
  return (
    <form className="rounded-md border border-[#d1d5db] bg-[#f3f4f6] p-4" onSubmit={onSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <InputField label="Date" name="payment_date" onChange={(v) => onChange("payment_date", v)} required type="date" value={form.payment_date} />
        <InputField label="Amount" min="1" name="amount" onChange={(v) => onChange("amount", v)} placeholder="Amount" required type="number" value={form.amount} />
        <SelectField label="Method" name="method" onChange={(v) => onChange("method", v as PaymentFormState["method"])} value={form.method}>
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="card">Card</option>
          <option value="cheque">Cheque</option>
          <option value="other">Other</option>
        </SelectField>
        <InputField label="Receipt number" name="receipt_number" onChange={(v) => onChange("receipt_number", v)} value={form.receipt_number} />
        <div className="sm:col-span-2">
          <InputField label="Notes" name="notes" onChange={(v) => onChange("notes", v)} value={form.notes} />
        </div>
      </div>
      {error ? <p className="mt-2 text-sm text-[#d64545]">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <button
          className="min-h-9 rounded-md bg-[#2563eb] px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-70"
          disabled={saving}
          type="submit"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          className="min-h-9 rounded-md border border-[#d1d5db] px-4 py-1.5 text-sm font-semibold text-[#6b7280] transition hover:bg-white"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function PaymentsSection({
  onMutated,
  payments,
  studentId,
}: {
  onMutated: () => void;
  payments: PaymentRecord[];
  studentId: number;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState<PaymentFormState>(emptyPaymentForm);
  const [saveState, setSaveState] = useState<{ status: "idle" } | { status: "saving" } | { status: "error"; message: string }>({ status: "idle" });

  function updateField<K extends keyof PaymentFormState>(field: K, value: PaymentFormState[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function startAdd() {
    setForm({ ...emptyPaymentForm, payment_date: new Date().toISOString().slice(0, 10) });
    setSaveState({ status: "idle" });
    setIsAdding(true);
  }

  function cancel() {
    setIsAdding(false);
    setSaveState({ status: "idle" });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const amountNum = parseInt(form.amount, 10);
    if (!form.payment_date) {
      setSaveState({ status: "error", message: "Payment date is required." });
      return;
    }
    if (!form.amount || isNaN(amountNum) || amountNum <= 0) {
      setSaveState({ status: "error", message: "Amount must be a positive number." });
      return;
    }
    setSaveState({ status: "saving" });
    try {
      const res = await fetch(`${getApiBaseUrl()}/students/${studentId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: amountNum }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveState({ status: "error", message: data.detail || "Payment could not be saved." });
        return;
      }
      setIsAdding(false);
      setSaveState({ status: "idle" });
      onMutated();
    } catch {
      setSaveState({ status: "error", message: "Could not connect to server." });
    }
  }

  return (
    <section className="rounded-lg border border-[#d1d5db] bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">
          Payment History <span className="text-sm font-normal text-[#6b7280]">({payments.length})</span>
        </h3>
        {!isAdding ? (
          <button
            className="rounded-md border border-[#d1d5db] px-3 py-1.5 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f3f4f6]"
            onClick={startAdd}
            type="button"
          >
            Add Payment
          </button>
        ) : null}
      </div>

      {isAdding ? (
        <div className="mt-3">
          <PaymentForm
            error={saveState.status === "error" ? saveState.message : null}
            form={form}
            onCancel={cancel}
            onChange={updateField}
            onSubmit={handleSubmit}
            saving={saveState.status === "saving"}
          />
        </div>
      ) : null}

      <div className="mt-3">
        {payments.length === 0 ? (
          <p className="rounded-md border border-dashed border-[#d1d5db] p-4 text-center text-sm text-[#6b7280]">No payments recorded.</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#d1d5db] text-[#6b7280]">
                    <th className="py-2 pr-4 font-semibold">Date</th>
                    <th className="py-2 pr-4 font-semibold">Amount</th>
                    <th className="py-2 pr-4 font-semibold">Method</th>
                    <th className="py-2 pr-4 font-semibold">Receipt</th>
                    <th className="py-2 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr className="border-b border-[#d1d5db]" key={payment.id}>
                      <td className="py-2 pr-4">{formatDate(payment.payment_date)}</td>
                      <td className="py-2 pr-4 font-medium text-[#2f9e44]">{formatCurrency(payment.amount)}</td>
                      <td className="py-2 pr-4 text-[#6b7280]">{titleCase(payment.method)}</td>
                      <td className="py-2 pr-4 text-[#6b7280]">{payment.receipt_number || "-"}</td>
                      <td className="py-2 text-[#6b7280]">{payment.notes || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 md:hidden">
              {payments.map((payment) => (
                <div className="rounded-md border border-[#d1d5db] p-3" key={payment.id}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-[#2f9e44]">{formatCurrency(payment.amount)}</p>
                    <p className="text-sm text-[#6b7280]">{formatDate(payment.payment_date)}</p>
                  </div>
                  <p className="mt-1 text-sm text-[#6b7280]">
                    {titleCase(payment.method)}
                    {payment.receipt_number ? ` - Receipt: ${payment.receipt_number}` : ""}
                  </p>
                  {payment.notes ? <p className="mt-1 text-sm text-[#6b7280]">{payment.notes}</p> : null}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

async function downloadCsv(url: string, filename: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) return;
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
  } catch {
    // silently fail
  }
}

function ReportsView() {
  const [activeTab, setActiveTab] = useState<ReportTab>("students");

  const tabs: { label: string; value: ReportTab }[] = [
    { label: "Students", value: "students" },
    { label: "Payments", value: "payments" },
    { label: "Pending Fees", value: "pending-fees" },
    { label: "Training Days", value: "training-days" },
  ];

  return (
    <section className="rounded-lg border border-[#d1d5db] bg-white p-4 sm:p-5">
      <div>
        <h2 className="text-xl font-semibold">Reports</h2>
        <p className="text-sm text-[#6b7280]">View summaries and export data.</p>
      </div>

      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-[#d1d5db]">
        {tabs.map((tab) => (
          <button
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium -mb-px border-b-2 transition ${
              activeTab === tab.value
                ? "border-[#2563eb] text-[#2563eb]"
                : "border-transparent text-[#6b7280] hover:text-[#1f2937]"
            }`}
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {activeTab === "students" ? <StudentsReport /> : null}
        {activeTab === "payments" ? <PaymentsReport /> : null}
        {activeTab === "pending-fees" ? <PendingFeesReport /> : null}
        {activeTab === "training-days" ? <TrainingDaysReport /> : null}
      </div>
    </section>
  );
}

function StudentsReport() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [reportState, setReportState] = useState<
    { status: "loading" } | { status: "ready"; data: StudentsReportData } | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      setReportState({ status: "loading" });
      try {
        const params = new URLSearchParams();
        if (statusFilter !== "all") params.set("status", statusFilter);
        const response = await fetch(`${getApiBaseUrl()}/reports/students?${params}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Request failed with ${response.status}`);
        const data = (await response.json()) as StudentsReportData;
        if (!isCancelled) setReportState({ status: "ready", data });
      } catch {
        if (!isCancelled) setReportState({ status: "error", message: "Could not load students report." });
      }
    }

    void load();
    return () => { isCancelled = true; };
  }, [statusFilter]);

  const statusOptions = [
    { label: "All", value: "all" },
    { label: "Active", value: "active" },
    { label: "Paused", value: "paused" },
    { label: "Completed", value: "completed" },
    { label: "Archived", value: "archived" },
  ];

  const data = reportState.status === "ready" ? reportState.data : null;

  function handleExport() {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    void downloadCsv(`${getApiBaseUrl()}/reports/students/csv?${params}`, "students.csv");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {statusOptions.map((opt) => (
            <button
              className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${
                statusFilter === opt.value ? "bg-[#1f2937] text-white" : "text-[#6b7280] hover:bg-[#f3f4f6]"
              }`}
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              type="button"
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          className="min-h-10 rounded-md border border-[#d1d5db] px-3 py-2 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f3f4f6]"
          onClick={handleExport}
          type="button"
        >
          Export CSV
        </button>
      </div>

      {data ? (
        <div className="flex flex-wrap gap-3">
          {["active", "paused", "completed", "archived"].map((s) => (
            data.counts[s] !== undefined ? (
              <div className="rounded-md border border-[#d1d5db] px-3 py-2 text-sm" key={s}>
                <span className="text-[#6b7280]">{titleCase(s)}: </span>
                <span className="font-semibold">{data.counts[s]}</span>
              </div>
            ) : null
          ))}
        </div>
      ) : null}

      {reportState.status === "loading" ? <p className="text-sm text-[#6b7280]">Loading...</p> : null}
      {reportState.status === "error" ? <Alert tone="danger">{reportState.message}</Alert> : null}

      {reportState.status === "ready" && data!.students.length === 0 ? (
        <p className="rounded-md border border-dashed border-[#d1d5db] p-6 text-center text-sm text-[#6b7280]">
          No students match the selected filter.
        </p>
      ) : null}

      {reportState.status === "ready" && data!.students.length > 0 ? (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#d1d5db] text-[#6b7280]">
                  <th className="py-2 pr-4 font-semibold">Name</th>
                  <th className="py-2 pr-4 font-semibold">Phone</th>
                  <th className="py-2 pr-4 font-semibold">Course</th>
                  <th className="py-2 pr-4 font-semibold">Joining</th>
                  <th className="py-2 pr-4 font-semibold">Status</th>
                  <th className="py-2 pr-4 font-semibold">Total Fee</th>
                  <th className="py-2 pr-4 font-semibold">Paid</th>
                  <th className="py-2 font-semibold">Pending</th>
                </tr>
              </thead>
              <tbody>
                {data!.students.map((student) => (
                  <tr className="border-b border-[#d1d5db]" key={student.id}>
                    <td className="py-2 pr-4 font-medium">{student.full_name}</td>
                    <td className="py-2 pr-4 text-[#6b7280]">{student.phone}</td>
                    <td className="py-2 pr-4 text-[#6b7280]">{student.course_type || "-"}</td>
                    <td className="py-2 pr-4 text-[#6b7280]">{formatDate(student.joining_date)}</td>
                    <td className="py-2 pr-4"><StatusBadge status={student.status} /></td>
                    <td className="py-2 pr-4 text-[#6b7280]">{formatCurrency(student.total_fee_amount)}</td>
                    <td className="py-2 pr-4 text-[#2f9e44]">{formatCurrency(student.paid_amount)}</td>
                    <td className={`py-2 font-medium ${student.pending_amount > 0 ? "text-[#d64545]" : "text-[#2f9e44]"}`}>
                      {formatCurrency(student.pending_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
            {data!.students.map((student) => (
              <div className="rounded-md border border-[#d1d5db] p-3" key={student.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{student.full_name}</p>
                    <p className="text-sm text-[#6b7280]">{student.phone}</p>
                  </div>
                  <StatusBadge status={student.status} />
                </div>
                <p className="mt-1 text-sm text-[#6b7280]">{student.course_type || "No course"} - Joined {formatDate(student.joining_date)}</p>
                <p className={`mt-1 text-sm font-medium ${student.pending_amount > 0 ? "text-[#d64545]" : "text-[#2f9e44]"}`}>
                  Pending {formatCurrency(student.pending_amount)}
                </p>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function PaymentsReport() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 7) + "-01";
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);
  const [reportState, setReportState] = useState<
    { status: "loading" } | { status: "ready"; data: PaymentsReportData } | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      setReportState({ status: "loading" });
      try {
        const params = new URLSearchParams();
        if (fromDate) params.set("from_date", fromDate);
        if (toDate) params.set("to_date", toDate);
        const response = await fetch(`${getApiBaseUrl()}/reports/payments?${params}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Request failed with ${response.status}`);
        const data = (await response.json()) as PaymentsReportData;
        if (!isCancelled) setReportState({ status: "ready", data });
      } catch {
        if (!isCancelled) setReportState({ status: "error", message: "Could not load payments report." });
      }
    }

    void load();
    return () => { isCancelled = true; };
  }, [fromDate, toDate]);

  const data = reportState.status === "ready" ? reportState.data : null;

  function handleExport() {
    const params = new URLSearchParams();
    if (fromDate) params.set("from_date", fromDate);
    if (toDate) params.set("to_date", toDate);
    void downloadCsv(`${getApiBaseUrl()}/reports/payments/csv?${params}`, "payments.csv");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="text-sm font-medium" htmlFor="pay-from">From</label>
            <input
              className="mt-1 block min-h-10 rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
              id="pay-from"
              onChange={(e) => setFromDate(e.target.value)}
              type="date"
              value={fromDate}
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="pay-to">To</label>
            <input
              className="mt-1 block min-h-10 rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
              id="pay-to"
              onChange={(e) => setToDate(e.target.value)}
              type="date"
              value={toDate}
            />
          </div>
        </div>
        <button
          className="min-h-10 rounded-md border border-[#d1d5db] px-3 py-2 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f3f4f6]"
          onClick={handleExport}
          type="button"
        >
          Export CSV
        </button>
      </div>

      {data ? (
        <div className="flex flex-wrap gap-3">
          <div className="rounded-md border border-[#d1d5db] px-3 py-2 text-sm">
            <span className="text-[#6b7280]">Payments: </span>
            <span className="font-semibold">{data.count}</span>
          </div>
          <div className="rounded-md border border-[#d1d5db] px-3 py-2 text-sm">
            <span className="text-[#6b7280]">Total collected: </span>
            <span className="font-semibold text-[#2f9e44]">{formatCurrency(data.total_amount)}</span>
          </div>
        </div>
      ) : null}

      {reportState.status === "loading" ? <p className="text-sm text-[#6b7280]">Loading...</p> : null}
      {reportState.status === "error" ? <Alert tone="danger">{reportState.message}</Alert> : null}

      {reportState.status === "ready" && data!.payments.length === 0 ? (
        <p className="rounded-md border border-dashed border-[#d1d5db] p-6 text-center text-sm text-[#6b7280]">
          No payments found for the selected date range.
        </p>
      ) : null}

      {reportState.status === "ready" && data!.payments.length > 0 ? (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#d1d5db] text-[#6b7280]">
                  <th className="py-2 pr-4 font-semibold">Date</th>
                  <th className="py-2 pr-4 font-semibold">Student</th>
                  <th className="py-2 pr-4 font-semibold">Phone</th>
                  <th className="py-2 pr-4 font-semibold">Amount</th>
                  <th className="py-2 pr-4 font-semibold">Method</th>
                  <th className="py-2 pr-4 font-semibold">Receipt</th>
                  <th className="py-2 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody>
                {data!.payments.map((payment) => (
                  <tr className="border-b border-[#d1d5db]" key={payment.id}>
                    <td className="py-2 pr-4">{formatDate(payment.payment_date)}</td>
                    <td className="py-2 pr-4 font-medium">{payment.full_name}</td>
                    <td className="py-2 pr-4 text-[#6b7280]">{payment.phone}</td>
                    <td className="py-2 pr-4 font-medium text-[#2f9e44]">{formatCurrency(payment.amount)}</td>
                    <td className="py-2 pr-4 text-[#6b7280]">{titleCase(payment.method)}</td>
                    <td className="py-2 pr-4 text-[#6b7280]">{payment.receipt_number || "-"}</td>
                    <td className="py-2 text-[#6b7280]">{payment.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
            {data!.payments.map((payment) => (
              <div className="rounded-md border border-[#d1d5db] p-3" key={payment.id}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-[#2f9e44]">{formatCurrency(payment.amount)}</p>
                  <p className="text-sm text-[#6b7280]">{formatDate(payment.payment_date)}</p>
                </div>
                <p className="mt-1 font-medium">{payment.full_name}</p>
                <p className="mt-0.5 text-sm text-[#6b7280]">
                  {titleCase(payment.method)}{payment.receipt_number ? ` - ${payment.receipt_number}` : ""}
                </p>
                {payment.notes ? <p className="mt-0.5 text-sm text-[#6b7280]">{payment.notes}</p> : null}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function PendingFeesReport() {
  const [reportState, setReportState] = useState<
    { status: "loading" } | { status: "ready"; data: PendingFeesReportData } | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      setReportState({ status: "loading" });
      try {
        const response = await fetch(`${getApiBaseUrl()}/reports/pending-fees`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Request failed with ${response.status}`);
        const data = (await response.json()) as PendingFeesReportData;
        if (!isCancelled) setReportState({ status: "ready", data });
      } catch {
        if (!isCancelled) setReportState({ status: "error", message: "Could not load pending fees report." });
      }
    }

    void load();
    return () => { isCancelled = true; };
  }, []);

  const data = reportState.status === "ready" ? reportState.data : null;

  return (
    <div className="flex flex-col gap-4">
      {data ? (
        <div className="flex flex-wrap gap-3">
          <div className="rounded-md border border-[#d1d5db] px-3 py-2 text-sm">
            <span className="text-[#6b7280]">Students with pending fees: </span>
            <span className="font-semibold">{data.count}</span>
          </div>
          <div className="rounded-md border border-[#d1d5db] px-3 py-2 text-sm">
            <span className="text-[#6b7280]">Total pending: </span>
            <span className="font-semibold text-[#d64545]">{formatCurrency(data.total_pending)}</span>
          </div>
        </div>
      ) : null}

      {reportState.status === "loading" ? <p className="text-sm text-[#6b7280]">Loading...</p> : null}
      {reportState.status === "error" ? <Alert tone="danger">{reportState.message}</Alert> : null}

      {reportState.status === "ready" && data!.students.length === 0 ? (
        <p className="rounded-md border border-dashed border-[#d1d5db] p-6 text-center text-sm text-[#6b7280]">
          No students have pending fees.
        </p>
      ) : null}

      {reportState.status === "ready" && data!.students.length > 0 ? (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#d1d5db] text-[#6b7280]">
                  <th className="py-2 pr-4 font-semibold">Name</th>
                  <th className="py-2 pr-4 font-semibold">Phone</th>
                  <th className="py-2 pr-4 font-semibold">Course</th>
                  <th className="py-2 pr-4 font-semibold">Status</th>
                  <th className="py-2 pr-4 font-semibold">Total Fee</th>
                  <th className="py-2 pr-4 font-semibold">Paid</th>
                  <th className="py-2 font-semibold">Pending</th>
                </tr>
              </thead>
              <tbody>
                {data!.students.map((student) => (
                  <tr className="border-b border-[#d1d5db]" key={student.id}>
                    <td className="py-2 pr-4 font-medium">{student.full_name}</td>
                    <td className="py-2 pr-4 text-[#6b7280]">{student.phone}</td>
                    <td className="py-2 pr-4 text-[#6b7280]">{student.course_type || "-"}</td>
                    <td className="py-2 pr-4"><StatusBadge status={student.status} /></td>
                    <td className="py-2 pr-4 text-[#6b7280]">{formatCurrency(student.total_fee_amount)}</td>
                    <td className="py-2 pr-4 text-[#2f9e44]">{formatCurrency(student.paid_amount)}</td>
                    <td className="py-2 font-medium text-[#d64545]">{formatCurrency(student.pending_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
            {data!.students.map((student) => (
              <div className="rounded-md border border-[#d1d5db] p-3" key={student.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{student.full_name}</p>
                    <p className="text-sm text-[#6b7280]">{student.phone}</p>
                  </div>
                  <StatusBadge status={student.status} />
                </div>
                <p className="mt-1 text-sm text-[#6b7280]">{student.course_type || "No course"}</p>
                <div className="mt-2 flex gap-4 text-sm">
                  <span className="text-[#6b7280]">Paid: <span className="font-medium text-[#2f9e44]">{formatCurrency(student.paid_amount)}</span></span>
                  <span className="text-[#6b7280]">Pending: <span className="font-medium text-[#d64545]">{formatCurrency(student.pending_amount)}</span></span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function TrainingDaysReport() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 7) + "-01";
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);
  const [reportState, setReportState] = useState<
    { status: "loading" } | { status: "ready"; data: TrainingDaysReportData } | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      setReportState({ status: "loading" });
      try {
        const params = new URLSearchParams();
        if (fromDate) params.set("from_date", fromDate);
        if (toDate) params.set("to_date", toDate);
        const response = await fetch(`${getApiBaseUrl()}/reports/training-days?${params}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Request failed with ${response.status}`);
        const data = (await response.json()) as TrainingDaysReportData;
        if (!isCancelled) setReportState({ status: "ready", data });
      } catch {
        if (!isCancelled) setReportState({ status: "error", message: "Could not load training days report." });
      }
    }

    void load();
    return () => { isCancelled = true; };
  }, [fromDate, toDate]);

  const data = reportState.status === "ready" ? reportState.data : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="text-sm font-medium" htmlFor="td-from">From</label>
          <input
            className="mt-1 block min-h-10 rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
            id="td-from"
            onChange={(e) => setFromDate(e.target.value)}
            type="date"
            value={fromDate}
          />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="td-to">To</label>
          <input
            className="mt-1 block min-h-10 rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
            id="td-to"
            onChange={(e) => setToDate(e.target.value)}
            type="date"
            value={toDate}
          />
        </div>
      </div>

      {data ? (
        <div className="flex flex-wrap gap-3">
          <div className="rounded-md border border-[#d1d5db] px-3 py-2 text-sm">
            <span className="text-[#6b7280]">Total: </span>
            <span className="font-semibold">{data.total}</span>
          </div>
          {["planned", "completed", "cancelled", "missed"].map((s) =>
            data.counts[s] !== undefined ? (
              <div className="rounded-md border border-[#d1d5db] px-3 py-2 text-sm" key={s}>
                <span className="text-[#6b7280]">{titleCase(s)}: </span>
                <span className="font-semibold">{data.counts[s]}</span>
              </div>
            ) : null
          )}
        </div>
      ) : null}

      {reportState.status === "loading" ? <p className="text-sm text-[#6b7280]">Loading...</p> : null}
      {reportState.status === "error" ? <Alert tone="danger">{reportState.message}</Alert> : null}

      {reportState.status === "ready" && data!.training_days.length === 0 ? (
        <p className="rounded-md border border-dashed border-[#d1d5db] p-6 text-center text-sm text-[#6b7280]">
          No training days found for the selected date range.
        </p>
      ) : null}

      {reportState.status === "ready" && data!.training_days.length > 0 ? (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#d1d5db] text-[#6b7280]">
                  <th className="py-2 pr-4 font-semibold">Date</th>
                  <th className="py-2 pr-4 font-semibold">Student</th>
                  <th className="py-2 pr-4 font-semibold">Phone</th>
                  <th className="py-2 pr-4 font-semibold">Time</th>
                  <th className="py-2 pr-4 font-semibold">Status</th>
                  <th className="py-2 font-semibold">Instructor</th>
                </tr>
              </thead>
              <tbody>
                {data!.training_days.map((day) => (
                  <tr className="border-b border-[#d1d5db]" key={day.id}>
                    <td className="py-2 pr-4">{formatDate(day.training_date)}</td>
                    <td className="py-2 pr-4 font-medium">{day.full_name}</td>
                    <td className="py-2 pr-4 text-[#6b7280]">{day.phone}</td>
                    <td className="py-2 pr-4 text-[#6b7280]">{day.training_time || "-"}</td>
                    <td className="py-2 pr-4"><StatusBadge status={day.status} /></td>
                    <td className="py-2 text-[#6b7280]">{day.instructor_name || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
            {data!.training_days.map((day) => (
              <div className="rounded-md border border-[#d1d5db] p-3" key={day.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{day.full_name}</p>
                    <p className="text-sm text-[#6b7280]">{formatDate(day.training_date)}{day.training_time ? ` at ${day.training_time}` : ""}</p>
                  </div>
                  <StatusBadge status={day.status} />
                </div>
                {day.instructor_name ? <p className="mt-1 text-sm text-[#6b7280]">{day.instructor_name}</p> : null}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatusCard({
  label,
  loading,
  subtext,
  tone = "default",
  value,
}: {
  label: string;
  loading: boolean;
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
    <div className="rounded-lg border border-[#d1d5db] bg-white p-4">
      <p className="text-sm text-[#6b7280]">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${valueClassName}`}>
        {loading ? "-" : value}
      </p>
      {subtext ? <p className="mt-1 text-sm font-medium text-[#6b7280]">{subtext}</p> : null}
    </div>
  );
}

function DashboardStudentList({
  loading,
  onViewStudent,
  students,
}: {
  loading: boolean;
  onViewStudent: (id: number) => void;
  students: StudentListItem[];
}) {
  return (
    <div className="rounded-lg border border-[#d1d5db] bg-white p-4">
      <h2 className="text-lg font-semibold">Students</h2>
      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-[#6b7280]">Loading students...</p>
        ) : students.length === 0 ? (
          <p className="text-sm text-[#6b7280]">No students found.</p>
        ) : (
          <div className="max-h-[480px] overflow-y-auto space-y-2 pr-1">
            {students.map((student) => (
              <div
                className="flex items-center justify-between gap-3 rounded-md border border-[#d1d5db] p-3"
                key={student.id}
              >
                <div className="min-w-0">
                  <p className="font-semibold truncate">{student.full_name}</p>
                  <p className="text-sm text-[#6b7280]">{student.phone}</p>
                  <p className="mt-1 text-sm text-[#6b7280]">
                    Completed: <span className="font-medium text-[#1f2937]">{student.completed_training_days}</span>
                    {student.pending_amount > 0 && (
                      <span className="ml-3 text-[#d64545]">Pending {formatCurrency(student.pending_amount)}</span>
                    )}
                  </p>
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
    </div>
  );
}

function QuickActions({ onAddStudent }: { onAddStudent: () => void }) {
  return (
    <div className="rounded-lg border border-[#d1d5db] bg-white p-4">
      <h2 className="text-lg font-semibold">Quick Actions</h2>
      <div className="mt-4 grid gap-3">
        <button
          className="min-h-11 rounded-md bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
          onClick={onAddStudent}
          type="button"
        >
          Add Student
        </button>
      </div>
    </div>
  );
}

function RecentStudents({
  loading,
  students,
}: {
  loading: boolean;
  students: RecentStudent[];
}) {
  return (
    <div className="rounded-lg border border-[#d1d5db] bg-white p-4">
      <h2 className="text-lg font-semibold">Recently Added</h2>
      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-[#6b7280]">Loading students...</p>
        ) : students.length === 0 ? (
          <p className="text-sm text-[#6b7280]">No students added yet.</p>
        ) : (
          <div className="space-y-3">
            {students.map((student) => (
              <div className="rounded-md border border-[#d1d5db] p-3" key={student.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{student.full_name}</p>
                    <p className="text-sm text-[#6b7280]">{student.phone}</p>
                  </div>
                  <StatusBadge status={student.status} />
                </div>
                <p className="mt-2 text-sm text-[#6b7280]">
                  {student.course_type} - Joined {formatDate(student.joining_date)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalizedStatus = status.toLowerCase();
  const className =
    normalizedStatus === "completed"
      ? "bg-[#2f9e44]/10 text-[#2f9e44]"
      : normalizedStatus === "planned" || normalizedStatus === "active"
        ? "bg-[#2563eb]/10 text-[#2563eb]"
        : normalizedStatus === "missed" || normalizedStatus === "cancelled"
          ? "bg-[#d64545]/10 text-[#d64545]"
          : "bg-[#f5b700]/20 text-[#1f2937]";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${className}`}>
      {titleCase(status)}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  const isEmpty = value === null || value === undefined || value === "";
  return (
    <div className="flex gap-3">
      <dt className="w-32 shrink-0 text-[#6b7280]">{label}</dt>
      <dd className={isEmpty ? "text-[#6b7280]" : ""}>{isEmpty ? "-" : value}</dd>
    </div>
  );
}

function InputField({
  autoComplete,
  label,
  min,
  name,
  onChange,
  placeholder,
  required = false,
  type = "text",
  value,
}: {
  autoComplete?: string;
  label: string;
  min?: string;
  name: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium" htmlFor={name}>
        {label}
        {required ? <span className="text-[#d64545]"> *</span> : null}
      </label>
      <input
        autoComplete={autoComplete}
        className="mt-2 min-h-11 w-full rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-base outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
        id={name}
        min={min}
        name={name}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </div>
  );
}

function SelectField({
  children,
  label,
  name,
  onChange,
  value,
}: {
  children: ReactNode;
  label: string;
  name: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium" htmlFor={name}>
        {label}
      </label>
      <select
        className="mt-2 min-h-11 w-full rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-base outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
        id={name}
        name={name}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
    </div>
  );
}

function TextareaField({
  label,
  name,
  onChange,
  value,
}: {
  label: string;
  name: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium" htmlFor={name}>
        {label}
      </label>
      <textarea
        className="mt-2 min-h-24 w-full resize-y rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-base outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
        id={name}
        name={name}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </div>
  );
}

function Alert({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "danger" | "success";
}) {
  const className =
    tone === "success"
      ? "border-[#2f9e44]/30 bg-[#2f9e44]/10 text-[#2f9e44]"
      : "border-[#d64545]/30 bg-[#d64545]/10 text-[#d64545]";

  return (
    <p className={`rounded-md border px-3 py-2 text-sm font-medium ${className}`}>
      {children}
    </p>
  );
}
