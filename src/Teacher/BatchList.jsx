import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  BookOpen,
  CalendarDays,
  Clock3,
  Globe,
  MapPin,
  Plus,
  Search,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { onAuthStateChanged } from "../lib/auth";
import { useNavigate } from "react-router-dom";

import { auth } from "../lib/backend";
import { getMyCourses } from "../services/CourseService";
import {
  createBatch,
  getBatchesForTeacher,
  getNextScheduledSession,
} from "../services/BatchService";

const WEEK_DAYS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

const MODES = [
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "hybrid", label: "Hybrid" },
];

function modeConfig(mode) {
  switch (mode) {
    case "online":
      return {
        label: "Online",
        className: "bg-sky-50 text-sky-700",
        icon: Globe,
      };
    case "offline":
      return {
        label: "Offline",
        className: "bg-amber-50 text-amber-700",
        icon: MapPin,
      };
    case "hybrid":
      return {
        label: "Hybrid",
        className: "bg-violet-50 text-violet-700",
        icon: BookOpen,
      };
    default:
      return {
        label: mode || "Unknown",
        className: "bg-violet-50 text-slate-600",
        icon: BookOpen,
      };
  }
}

function statusConfig(status) {
  if (status === "archived") {
    return {
      label: "Archived",
      className: "bg-violet-50 text-slate-500",
      icon: Archive,
    };
  }

  return {
    label: "Active",
    className: "bg-emerald-50 text-emerald-700",
    icon: Clock3,
  };
}

function emptyForm() {
  return {
    name: "",
    courseId: "",
    mode: "online",
    days: [],
    time: "10:00",
  };
}

export default function BatchList() {
  const navigate = useNavigate();

  const [teacher, setTeacher] = useState(null);
  const [batches, setBatches] = useState([]);
  const [courses, setCourses] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setTeacher(user || null);

      if (!user) {
        setBatches([]);
        setCourses([]);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  async function loadData(uid) {
    setLoading(true);
    setError("");

    try {
      const [batchList, courseList] = await Promise.all([
        getBatchesForTeacher(uid),
        getMyCourses(uid),
      ]);

      setBatches(batchList);
      setCourses(courseList);
    } catch (err) {
      console.error("Load batches:", err);
      setError(err?.message || "Unable to load batches.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!teacher?.uid) return;
    loadData(teacher.uid);
  }, [teacher?.uid]);

  const courseMap = useMemo(() => {
    const map = {};
    courses.forEach((course) => {
      map[course.id] = course.title || course.name || "Untitled course";
    });
    return map;
  }, [courses]);

  const filteredBatches = useMemo(() => {
    const term = search.trim().toLowerCase();

    return batches.filter((batch) => {
      const courseName = courseMap[batch.courseId] || "";
      const matchesSearch =
        !term ||
        String(batch.name || "").toLowerCase().includes(term) ||
        courseName.toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "all" || batch.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [batches, courseMap, search, statusFilter]);

  const counts = useMemo(
    () => ({
      all: batches.length,
      active: batches.filter((batch) => batch.status === "active").length,
      archived: batches.filter((batch) => batch.status === "archived").length,
    }),
    [batches]
  );

  function toggleDay(day) {
    setForm((current) => {
      const exists = current.days.includes(day);

      return {
        ...current,
        days: exists
          ? current.days.filter((item) => item !== day)
          : [...current.days, day],
      };
    });
  }

  async function handleCreate(event) {
    event.preventDefault();

    if (!teacher?.uid) return;

    setSaving(true);
    setActionError("");

    try {
      await createBatch(
        form.courseId,
        teacher.uid,
        form.name,
        form.mode,
        {
          days: form.days,
          time: form.time,
        }
      );

      setModalOpen(false);
      setForm(emptyForm());
      await loadData(teacher.uid);
    } catch (err) {
      console.error("Create batch:", err);
      setActionError(err?.message || "Unable to create batch.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-hidden bg-slate-50">
      <div className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-1 text-sm text-slate-500">
              Teacher Dashboard
            </p>

            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
              Batches
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Group enrolled students into scheduled classes with attendance.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setActionError("");
              setForm((current) => ({
                ...emptyForm(),
                courseId: current.courseId || courses[0]?.id || "",
              }));
              setModalOpen(true);
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700 sm:w-auto"
          >
            <Plus size={17} />
            Create Batch
          </button>
        </div>

        {(error || actionError) && !modalOpen && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <XCircle size={18} className="mt-0.5 shrink-0" />
            <span>{actionError || error}</span>
          </div>
        )}

        <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
          <MiniStat
            label="All Batches"
            value={counts.all}
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
          />
          <MiniStat
            label="Active"
            value={counts.active}
            active={statusFilter === "active"}
            onClick={() => setStatusFilter("active")}
          />
          <MiniStat
            label="Archived"
            value={counts.archived}
            active={statusFilter === "archived"}
            onClick={() => setStatusFilter("archived")}
          />
        </div>

        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
          <div className="relative">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search batches or courses..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-violet-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-violet-600" />
          </div>
        ) : filteredBatches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
            <Users className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">
              No batches yet
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Create a batch to assign enrolled students and take attendance.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            {filteredBatches.map((batch) => {
              const mode = modeConfig(batch.mode);
              const status = statusConfig(batch.status);
              const ModeIcon = mode.icon;
              const StatusIcon = status.icon;

              return (
                <button
                  key={batch.id}
                  type="button"
                  onClick={() => navigate(`/teacher/batches/${batch.id}`)}
                  className="w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-violet-200 hover:shadow-sm sm:p-5"
                >
                  <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      <h2 className="break-words text-base font-semibold text-slate-900">
                        {batch.name}
                      </h2>
                      <p className="mt-1 break-words text-sm leading-5 text-slate-500">
                        {courseMap[batch.courseId] || "Course"}
                      </p>
                    </div>

                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
                    >
                      <StatusIcon size={12} />
                      {status.label}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${mode.className}`}
                    >
                      <ModeIcon size={12} />
                      {mode.label}
                    </span>

                    <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                      <Users size={12} />
                      {batch.studentCount || 0} students
                    </span>
                  </div>

                  <div className="mt-4 flex min-w-0 items-center gap-2 text-sm text-slate-600">
                    <CalendarDays size={15} className="shrink-0 text-slate-400" />
                    <span className="min-w-0 truncate">
                      Next: {getNextScheduledSession(batch.schedule)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-2 sm:items-center sm:p-4">
          <div className="box-border max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] min-w-0 max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl sm:max-h-[calc(100dvh-2rem)] sm:w-full">
            <div className="flex min-w-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-900">
                  Create Batch
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Students must already be enrolled in the course.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-violet-50 hover:text-slate-700"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="min-w-0 space-y-4 px-4 py-5 sm:px-5">
              {actionError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {actionError}
                </div>
              )}

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Batch name
                </span>
                <input
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Morning batch"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Course
                </span>
                <select
                  required
                  value={form.courseId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      courseId: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
                >
                  <option value="">Select a course</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title || course.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Mode
                </span>
                <select
                  value={form.mode}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      mode: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
                >
                  {MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Schedule days
                </span>
                <div className="flex flex-wrap gap-2">
                  {WEEK_DAYS.map((day) => {
                    const selected = form.days.includes(day);

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${selected
                          ? "bg-violet-600 text-white"
                          : "bg-violet-50 text-slate-600"
                          }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Time
                </span>
                <input
                  type="time"
                  value={form.time}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      time: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
                />
              </label>

              <div className="flex flex-col-reverse gap-2 pt-2 min-[381px]:flex-row min-[381px]:justify-end">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-violet-50 min-[381px]:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 min-[381px]:w-auto"
                >
                  {saving ? "Creating..." : "Create Batch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-2 py-2.5 text-left transition sm:px-4 sm:py-3 ${active
        ? "border-violet-200 bg-violet-50"
        : "border-slate-200 bg-white hover:border-slate-300"
        }`}
    >
      <p className="text-[10px] font-medium leading-4 text-slate-500 sm:text-xs">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </button>
  );
}
