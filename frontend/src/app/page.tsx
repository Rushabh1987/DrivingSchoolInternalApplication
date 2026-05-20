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
  vehicle_number: string;
  notes: string;
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

    if (!form.full_name.trim() || !form.phone.trim() || !form.course_type.trim() || !form.joining_date) {
      setSubmitState({ status: "error", message: "Name, phone, course, and joining date are required." });
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
          <InputField label="Phone number" name="phone" onChange={(value) => updateField("phone", value)} required value={form.phone} />
          <InputField label="Course type" name="course_type" onChange={(value) => updateField("course_type", value)} placeholder="Car, Two Wheeler, Refresher" required value={form.course_type} />
          <InputField label="Joining date" name="joining_date" onChange={(value) => updateField("joining_date", value)} required type="date" value={form.joining_date} />
          <SelectField label="Status" name="status" onChange={(value) => updateField("status", value as StudentFormState["status"])} value={form.status}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </SelectField>
          <InputField label="Total fees" name="total_fee_amount" onChange={(value) => updateField("total_fee_amount", value)} placeholder="0" type="number" value={form.total_fee_amount} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <InputField label="Alternate phone" name="alternate_phone" onChange={(value) => updateField("alternate_phone", value)} value={form.alternate_phone} />
          <InputField label="Email" name="email" onChange={(value) => updateField("email", value)} type="email" value={form.email} />
          <InputField label="Date of birth" name="date_of_birth" onChange={(value) => updateField("date_of_birth", value)} type="date" value={form.date_of_birth} />
          <InputField label="Learner permit number" name="learner_permit_number" onChange={(value) => updateField("learner_permit_number", value)} value={form.learner_permit_number} />
          <InputField label="Learner permit expiry" name="learner_permit_expiry_date" onChange={(value) => updateField("learner_permit_expiry_date", value)} type="date" value={form.learner_permit_expiry_date} />
          <InputField label="License number" name="license_number" onChange={(value) => updateField("license_number", value)} value={form.license_number} />
        </div>

        <TextareaField label="Address" name="address" onChange={(value) => updateField("address", value)} value={form.address} />
        <TextareaField label="Notes" name="notes" onChange={(value) => updateField("notes", value)} value={form.notes} />

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
  studentId,
}: {
  onBack: () => void;
  studentId: number | null;
}) {
  return (
    <section className="rounded-lg border border-[#d1d5db] bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Student Profile</h2>
          <p className="text-sm text-[#6b7280]">Student ID: {studentId}</p>
        </div>
        <button
          className="min-h-10 rounded-md border border-[#d1d5db] px-3 py-2 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f3f4f6]"
          onClick={onBack}
          type="button"
        >
          Back to Students
        </button>
      </div>
      <p className="mt-6 rounded-md border border-dashed border-[#d1d5db] p-6 text-center text-sm text-[#6b7280]">
        Full student profile will be available in the next update.
      </p>
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
                      {item.vehicle_number ? ` - ${item.vehicle_number}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                {item.notes ? <p className="mt-2 text-sm text-[#6b7280]">{item.notes}</p> : null}
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
