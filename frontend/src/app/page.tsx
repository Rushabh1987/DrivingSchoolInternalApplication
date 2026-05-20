"use client";

import { FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

const SESSION_KEY = "driving-school-admin-session";
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "password";
const SESSION_TIMEOUT_MS = 12 * 60 * 60 * 1000;

const SESSION_CHANGE_EVENT = "driving-school-session-change";

type ViewName = "dashboard" | "add-student" | "students" | "student-profile";

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
  next_training_date: string | null;
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
          <div>
            <p className="text-sm font-medium text-[#6b7280]">Driving School</p>
            <h1 className="mt-1 text-2xl font-semibold">Admin Sign In</h1>
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
  return (
    <header className="border-b border-[#d1d5db] bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#6b7280]">Admin</p>
          <h1 className="text-2xl font-semibold">Driving School</h1>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <nav className="flex gap-2 overflow-x-auto text-sm font-medium">
            <NavButton
              active={activeView === "dashboard"}
              label="Dashboard"
              onClick={() => onViewChange("dashboard")}
            />
            <NavButton
              active={activeView === "students"}
              label="Students"
              onClick={() => onViewChange("students")}
            />
            <NavButton
              active={activeView === "add-student"}
              label="Add Student"
              onClick={() => onViewChange("add-student")}
            />
          </nav>

          <button
            className="min-h-10 rounded-md border border-[#d1d5db] px-3 py-2 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f3f4f6]"
            onClick={onLogout}
            type="button"
          >
            Logout
          </button>
        </div>
      </div>
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
  refreshKey,
  successMessage,
}: {
  onAddStudent: () => void;
  refreshKey: number;
  successMessage: string;
}) {
  const [dashboardState, setDashboardState] = useState<DashboardState>({
    status: "loading",
  });

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

    void loadDashboard();

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
        <TrainingPanel data={data} />

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
              <th className="py-3 pr-4 font-semibold">Next Training</th>
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
                <td className="py-3 pr-4 text-[#6b7280]">
                  {student.next_training_date ? formatDate(student.next_training_date) : "-"}
                </td>
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
              Next training: {student.next_training_date ? formatDate(student.next_training_date) : "None scheduled"}
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
            <p className="mt-1 text-sm text-[#6b7280]">{student.course_type} - Joined {formatDate(student.joining_date)}</p>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-[#d1d5db] bg-white p-4 sm:p-5">
          <h3 className="font-semibold">Personal Details</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <DetailRow label="Phone" value={student.phone} />
            <DetailRow label="Alternate phone" value={student.alternate_phone} />
            <DetailRow label="Email" value={student.email} />
            <DetailRow label="Date of birth" value={student.date_of_birth ? formatDate(student.date_of_birth) : null} />
            <DetailRow label="Address" value={student.address} />
          </dl>
        </section>

        <section className="rounded-lg border border-[#d1d5db] bg-white p-4 sm:p-5">
          <h3 className="font-semibold">Course & Permit</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <DetailRow label="Course" value={student.course_type} />
            <DetailRow label="Joining date" value={formatDate(student.joining_date)} />
            <DetailRow label="Learner permit" value={student.learner_permit_number} />
            <DetailRow label="Permit expiry" value={student.learner_permit_expiry_date ? formatDate(student.learner_permit_expiry_date) : null} />
            <DetailRow label="License" value={student.license_number} />
          </dl>
        </section>
      </div>

      {student.notes ? (
        <section className="rounded-lg border border-[#d1d5db] bg-white p-4 sm:p-5">
          <h3 className="font-semibold">Notes</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[#1f2937]">{student.notes}</p>
        </section>
      ) : null}

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
      const res = await fetch(`http://localhost:8000/students/${studentId}/payments`, {
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

function TrainingPanel({ data }: { data: DashboardData | null }) {
  return (
    <div className="rounded-lg border border-[#d1d5db] bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Today&apos;s Training</h2>
          <p className="text-sm text-[#6b7280]">{data ? formatDate(data.date) : "Loading..."}</p>
        </div>
      </div>

      <div className="mt-4">
        {!data ? (
          <div className="rounded-md border border-dashed border-[#d1d5db] p-6 text-sm text-[#6b7280]">
            Loading training days...
          </div>
        ) : data.todaysTraining.length === 0 ? (
          <div className="rounded-md border border-dashed border-[#d1d5db] p-6 text-sm text-[#6b7280]">
            No training days planned for today.
          </div>
        ) : (
          <div className="space-y-3">
            {data.todaysTraining.map((item) => (
              <div className="rounded-md border border-[#d1d5db] p-3" key={item.id}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{item.student_name}</p>
                    <p className="text-sm text-[#6b7280]">
                      {item.training_time || "Time not set"}
                      {item.instructor_name ? ` - ${item.instructor_name}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
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
        <button
          className="min-h-11 rounded-md border border-[#d1d5db] px-4 py-2 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f3f4f6]"
          type="button"
        >
          Update Training Day
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
  name,
  onChange,
  placeholder,
  required = false,
  type = "text",
  value,
}: {
  autoComplete?: string;
  label: string;
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
