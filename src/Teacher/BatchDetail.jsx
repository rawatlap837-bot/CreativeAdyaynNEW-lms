import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  ArrowRightLeft,
  CalendarDays,
  Plus,
  Search,
  Settings,
  Trash2,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { onAuthStateChanged } from "../lib/auth";
import { useNavigate, useParams } from "react-router-dom";

import { auth } from "../lib/backend";
import { getMyCourses } from "../services/CourseService";
import {
  addStudentToBatch,
  archiveBatch,
  deleteBatch,
  editBatch,
  getAttendanceForBatch,
  getAttendanceForDate,
  getBatchesForTeacher,
  getBatchRoster,
  getEligibleStudents,
  markAttendance,
  removeStudentFromBatch,
  shiftStudentBatch,
} from "../services/BatchService";
import {
  getAssignmentSubmissions,
  getTeacherAssignments,
} from "../services/AssignmentService";

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TABS = [
  { id: "roster", label: "Roster", icon: Users },
  { id: "attendance", label: "Attendance", icon: CalendarDays },
  { id: "settings", label: "Settings", icon: Settings },
];

function todayDate() {
  return new Date().toISOString().split("T")[0];
}

function studentLabel(student) {
  return (
    student.name ||
    student.displayName ||
    student.fullName ||
    student.email ||
    student.uid ||
    "Unknown student"
  );
}

function formatSessionDate(date) {
  if (!date) return "—";

  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatAssignmentDueDate(value) {
  if (!value) return "No due date";

  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);

  return Number.isNaN(date.getTime())
    ? "No due date"
    : date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
}

function statusButtonClass(current, value) {
  const active = current === value;

  if (value === "present") {
    return active
      ? "bg-emerald-600 text-white"
      : "bg-emerald-50 text-emerald-700";
  }

  if (value === "late") {
    return active
      ? "bg-amber-500 text-white"
      : "bg-amber-50 text-amber-700";
  }

  return active ? "bg-red-600 text-white" : "bg-red-50 text-red-700";
}

export default function BatchDetail() {
  const { batchId } = useParams();
  const navigate = useNavigate();

  const [teacher, setTeacher] = useState(null);
  const [batch, setBatch] = useState(null);
  const [students, setStudents] = useState([]);
  const [courseTitle, setCourseTitle] = useState("");
  const [batchAssignments, setBatchAssignments] = useState([]);

  const [tab, setTab] = useState("roster");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [eligible, setEligible] = useState([]);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [eligibleSearch, setEligibleSearch] = useState("");
  const [addingUid, setAddingUid] = useState("");

  const [shiftStudent, setShiftStudent] = useState(null);
  const [courseBatches, setCourseBatches] = useState([]);
  const [shiftTarget, setShiftTarget] = useState("");
  const [shifting, setShifting] = useState(false);

  const [attendanceDate, setAttendanceDate] = useState(todayDate());
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [studentStats, setStudentStats] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);

  const [settingsForm, setSettingsForm] = useState({
    name: "",
    mode: "online",
    days: [],
    time: "10:00",
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [removingUid, setRemovingUid] = useState("");

  const archived = batch?.status === "archived";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setTeacher(user || null);
    });

    return unsubscribe;
  }, []);

  async function loadBatch() {
    setLoading(true);
    setError("");

    try {
      const data = await getBatchRoster(batchId);

      setBatch(data.batch);
      setStudents(data.students);
      setSettingsForm({
        name: data.batch.name || "",
        mode: data.batch.mode || "online",
        days: data.batch.schedule?.days || [],
        time: data.batch.schedule?.time || "10:00",
      });

      const [courses, history, assignments] = await Promise.all([
        getMyCourses(data.batch.teacherId),
        getAttendanceForBatch(data.batch.id),
        getTeacherAssignments(data.batch.teacherId, data.batch.courseId),
      ]);

      const course = courses.find((item) => item.id === data.batch.courseId);
      setCourseTitle(course?.title || course?.name || data.batch.courseId);
      setAttendanceHistory(history);

      const targetedAssignments = assignments.filter(
        (assignment) => assignment.targetBatchId === data.batch.id
      );

      const assignmentsWithResults = await Promise.all(
        targetedAssignments.map(async (assignment) => {
          try {
            const submissions = await getAssignmentSubmissions(assignment.id);
            return {
              ...assignment,
              submittedCount: submissions.length,
            };
          } catch {
            return assignment;
          }
        })
      );

      setBatchAssignments(assignmentsWithResults);
    } catch (err) {
      console.error("Load batch:", err);
      setError(err?.message || "Unable to load this batch.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!batchId) return;
    loadBatch();
  }, [batchId]);

  async function loadAttendance(currentBatch, roster) {
    if (!currentBatch?.id) return;

    setAttendanceLoading(true);

    try {
      const [existing, history] = await Promise.all([
        getAttendanceForDate(currentBatch.id, attendanceDate),
        getAttendanceForBatch(currentBatch.id),
      ]);

      const nextRecords = {};

      roster.forEach((student) => {
        nextRecords[student.uid] =
          existing?.records?.[student.uid] || "present";
      });

      setAttendanceRecords(nextRecords);
      setAttendanceHistory(history);

      const stats = roster.map((student) => {
        const total = history.length;
        const present = history.filter(
          (session) => session.records?.[student.uid] === "present"
        ).length;

        return {
          studentUid: student.uid,
          total,
          present,
          percentage: total > 0 ? Math.round((present / total) * 100) : 0,
        };
      });

      setStudentStats(stats);
    } catch (err) {
      console.error("Load attendance:", err);
      setActionError(err?.message || "Unable to load attendance.");
    } finally {
      setAttendanceLoading(false);
    }
  }

  useEffect(() => {
    if (tab !== "attendance" || !batch) return;
    loadAttendance(batch, students);
  }, [tab, attendanceDate, batch?.id, students.length]);

  const filteredEligible = useMemo(() => {
    const term = eligibleSearch.trim().toLowerCase();

    if (!term) return eligible;

    return eligible.filter(
      (student) =>
        studentLabel(student).toLowerCase().includes(term) ||
        String(student.uid || "").toLowerCase().includes(term)
    );
  }, [eligible, eligibleSearch]);

  async function openAddModal() {
    if (!batch) return;

    setAddOpen(true);
    setEligibleLoading(true);
    setEligibleSearch("");
    setActionError("");

    try {
      const list = await getEligibleStudents(batch.courseId, batch.id);
      setEligible(list);
    } catch (err) {
      console.error("Eligible students:", err);
      setActionError(err?.message || "Unable to load eligible students.");
    } finally {
      setEligibleLoading(false);
    }
  }

  async function handleAddStudent(studentUid) {
    setAddingUid(studentUid);
    setActionError("");

    try {
      await addStudentToBatch(batch.id, studentUid);
      setAddOpen(false);
      await loadBatch();
    } catch (err) {
      console.error("Add student:", err);
      setActionError(err?.message || "Unable to add student.");
    } finally {
      setAddingUid("");
    }
  }

  async function handleRemoveStudent(studentUid) {
    const confirmed = window.confirm("Remove this student from the batch?");

    if (!confirmed) return;

    setRemovingUid(studentUid);
    setActionError("");

    try {
      await removeStudentFromBatch(batch.id, studentUid);
      await loadBatch();
    } catch (err) {
      console.error("Remove student:", err);
      setActionError(err?.message || "Unable to remove student.");
    } finally {
      setRemovingUid("");
    }
  }

  async function openShiftModal(student) {
    setShiftStudent(student);
    setShifting(false);
    setActionError("");

    try {
      const list = await getBatchesForTeacher(batch.teacherId);
      const others = list.filter(
        (item) =>
          item.id !== batch.id &&
          item.courseId === batch.courseId &&
          item.status === "active"
      );
      setCourseBatches(others);
      setShiftTarget(others[0]?.id || "");
    } catch (err) {
      console.error("Load shift batches:", err);
      setActionError(err?.message || "Unable to load destination batches.");
    }
  }

  async function handleShift() {
    if (!shiftStudent || !shiftTarget) return;

    setShifting(true);
    setActionError("");

    try {
      await shiftStudentBatch(batch.id, shiftTarget, shiftStudent.uid);
      setShiftStudent(null);
      await loadBatch();
    } catch (err) {
      console.error("Shift student:", err);
      setActionError(err?.message || "Unable to shift student.");
    } finally {
      setShifting(false);
    }
  }

  async function handleSaveAttendance() {
    if (!teacher?.uid || !batch) return;

    setSavingAttendance(true);
    setActionError("");
    setActionMessage("");

    try {
      await markAttendance(
        batch.id,
        attendanceDate,
        teacher.uid,
        attendanceRecords
      );
      setActionMessage("Attendance saved.");
      await loadAttendance(batch, students);
    } catch (err) {
      console.error("Save attendance:", err);
      setActionError(err?.message || "Unable to save attendance.");
    } finally {
      setSavingAttendance(false);
    }
  }

  function toggleSettingsDay(day) {
    setSettingsForm((current) => {
      const exists = current.days.includes(day);

      return {
        ...current,
        days: exists
          ? current.days.filter((item) => item !== day)
          : [...current.days, day],
      };
    });
  }

  async function handleSaveSettings(event) {
    event.preventDefault();
    setSavingSettings(true);
    setActionError("");
    setActionMessage("");

    try {
      await editBatch(batch.id, {
        name: settingsForm.name,
        mode: settingsForm.mode,
        schedule: {
          days: settingsForm.days,
          time: settingsForm.time,
        },
      });
      setActionMessage("Batch settings updated.");
      await loadBatch();
    } catch (err) {
      console.error("Edit batch:", err);
      setActionError(err?.message || "Unable to update batch.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleArchive() {
    const confirmed = window.confirm(
      "Archive this batch? Attendance history will be kept."
    );

    if (!confirmed) return;

    setActionError("");

    try {
      await archiveBatch(batch.id);
      await loadBatch();
    } catch (err) {
      console.error("Archive batch:", err);
      setActionError(err?.message || "Unable to archive batch.");
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      "Permanently delete this batch? This is only allowed when there is no attendance history."
    );

    if (!confirmed) return;

    setActionError("");

    try {
      await deleteBatch(batch.id);
      navigate("/teacher/batches");
    } catch (err) {
      console.error("Delete batch:", err);
      setActionError(err?.message || "Unable to delete batch.");
    }
  }

  const canDelete = attendanceHistory.length === 0;

  useEffect(() => {
    if (tab === "settings" && batch) {
      getAttendanceForBatch(batch.id)
        .then(setAttendanceHistory)
        .catch(() => { });
    }
  }, [tab, batch?.id]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-violet-600" />
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || "Batch not found."}
        </div>
        <button
          type="button"
          onClick={() => navigate("/teacher/batches")}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600"
        >
          <ArrowLeft size={16} />
          Back to batches
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <button
          type="button"
          onClick={() => navigate("/teacher/batches")}
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={16} />
          Back to batches
        </button>

        <div className="mb-6">
          <p className="text-sm text-slate-500">{courseTitle}</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            {batch.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {batch.studentCount || 0} students · {batch.mode} · {batch.status}
          </p>
        </div>

        {(actionError || actionMessage) && (
          <div
            className={`mb-5 rounded-xl border px-4 py-3 text-sm ${actionError
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
          >
            {actionError || actionMessage}
          </div>
        )}

        <div className="mb-5 flex gap-2 overflow-x-auto">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActionError("");
                  setActionMessage("");
                  setTab(item.id);
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${active
                  ? "bg-violet-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600"
                  }`}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </div>

        {tab === "roster" && (
          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-base font-semibold text-slate-900">
                  Current students
                </h2>
                <button
                  type="button"
                  disabled={archived}
                  onClick={openAddModal}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  <Plus size={16} />
                  Add Student
                </button>
              </div>

              {students.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">
                  No students in this batch yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {students.map((student) => (
                    <div
                      key={student.uid}
                      className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {studentLabel(student)}
                        </p>
                        <p className="text-xs text-slate-400">{student.uid}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={archived}
                          onClick={() => openShiftModal(student)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <ArrowRightLeft size={13} />
                          Shift to another batch
                        </button>
                        <button
                          type="button"
                          disabled={archived || removingUid === student.uid}
                          onClick={() => handleRemoveStudent(student.uid)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <UserMinus size={13} />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Batch assignments
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Assignments sent specifically to this batch.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/teacher/courses/${batch.courseId}/assignments`)}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Manage assignments
                </button>
              </div>

              {batchAssignments.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  No assignments have been sent to this batch.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {batchAssignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {assignment.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          Due: {formatAssignmentDueDate(assignment.dueDate)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-xs">
                        <span className="rounded-full bg-violet-50 px-2.5 py-1 font-medium capitalize text-slate-600">
                          {assignment.status || "draft"}
                        </span>
                        <span className="text-slate-500">
                          {assignment.submittedCount || 0}/{students.length} submitted
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {tab === "attendance" && (
          <section className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">
                    Session date
                  </span>
                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={(event) => setAttendanceDate(event.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
                  />
                </label>
                <button
                  type="button"
                  disabled={archived || savingAttendance || students.length === 0}
                  onClick={handleSaveAttendance}
                  className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {savingAttendance ? "Saving..." : "Save attendance"}
                </button>
              </div>

              {attendanceLoading ? (
                <div className="flex justify-center py-10">
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-violet-600" />
                </div>
              ) : students.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Add students to the roster before marking attendance.
                </p>
              ) : (
                <div className="space-y-3">
                  {students.map((student) => (
                    <div
                      key={student.uid}
                      className="flex flex-col gap-3 rounded-xl border border-slate-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <p className="text-sm font-medium text-slate-800">
                        {studentLabel(student)}
                      </p>
                      <div className="flex gap-2">
                        {["present", "late", "absent"].map((status) => (
                          <button
                            key={status}
                            type="button"
                            disabled={archived}
                            onClick={() =>
                              setAttendanceRecords((current) => ({
                                ...current,
                                [student.uid]: status,
                              }))
                            }
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${statusButtonClass(
                              attendanceRecords[student.uid],
                              status
                            )}`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-base font-semibold text-slate-900">
                Attendance history
              </h2>
              {attendanceHistory.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  No attendance sessions yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Present</th>
                        <th className="px-3 py-2">Late</th>
                        <th className="px-3 py-2">Absent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceHistory.map((session) => {
                        const values = Object.values(session.records || {});

                        return (
                          <tr key={session.id} className="border-b border-slate-50">
                            <td className="px-3 py-2 font-medium text-slate-800">
                              {formatSessionDate(session.date)}
                            </td>
                            <td className="px-3 py-2 text-emerald-700">
                              {values.filter((item) => item === "present").length}
                            </td>
                            <td className="px-3 py-2 text-amber-700">
                              {values.filter((item) => item === "late").length}
                            </td>
                            <td className="px-3 py-2 text-red-700">
                              {values.filter((item) => item === "absent").length}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-base font-semibold text-slate-900">
                Per-student % present
              </h2>
              {studentStats.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  Stats appear after attendance is marked.
                </p>
              ) : (
                <div className="space-y-2">
                  {students.map((student) => {
                    const stats = studentStats.find(
                      (item) => item.studentUid === student.uid
                    );

                    return (
                      <div
                        key={student.uid}
                        className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"
                      >
                        <span className="text-sm text-slate-700">
                          {studentLabel(student)}
                        </span>
                        <span className="text-sm font-semibold text-slate-900">
                          {stats?.percentage ?? 0}%
                          <span className="ml-2 text-xs font-normal text-slate-400">
                            {stats?.present || 0}/{stats?.total || 0} present
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {tab === "settings" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <form onSubmit={handleSaveSettings} className="max-w-xl space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Batch name
                </span>
                <input
                  required
                  value={settingsForm.name}
                  onChange={(event) =>
                    setSettingsForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Mode
                </span>
                <select
                  value={settingsForm.mode}
                  onChange={(event) =>
                    setSettingsForm((current) => ({
                      ...current,
                      mode: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
                >
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </label>

              <div>
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Schedule days
                </span>
                <div className="flex flex-wrap gap-2">
                  {WEEK_DAYS.map((day) => {
                    const selected = settingsForm.days.includes(day);

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleSettingsDay(day)}
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
                  value={settingsForm.time}
                  onChange={(event) =>
                    setSettingsForm((current) => ({
                      ...current,
                      time: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
                />
              </label>

              <button
                type="submit"
                disabled={savingSettings}
                className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {savingSettings ? "Saving..." : "Save settings"}
              </button>
            </form>

            <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row">
              <button
                type="button"
                disabled={archived}
                onClick={handleArchive}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                <Archive size={16} />
                Archive batch
              </button>
              <button
                type="button"
                disabled={!canDelete}
                onClick={handleDelete}
                title={
                  canDelete
                    ? "Delete this batch"
                    : "Delete is disabled because attendance history exists"
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 size={16} />
                Delete batch
              </button>
            </div>

            {!canDelete && (
              <p className="mt-3 text-xs text-slate-500">
                Delete is disabled because this batch has attendance records.
                Archive it instead to keep history.
              </p>
            )}
          </section>
        )}
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                Add enrolled student
              </h2>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-violet-50"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              <div className="relative mb-4">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={eligibleSearch}
                  onChange={(event) => setEligibleSearch(event.target.value)}
                  placeholder="Search enrolled students..."
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none"
                />
              </div>
              {eligibleLoading ? (
                <div className="flex justify-center py-8">
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-violet-600" />
                </div>
              ) : filteredEligible.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  No eligible enrolled students found.
                </p>
              ) : (
                <div className="max-h-80 space-y-2 overflow-y-auto">
                  {filteredEligible.map((student) => (
                    <div
                      key={student.uid}
                      className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {studentLabel(student)}
                        </p>
                        <p className="text-xs text-slate-400">
                          {student.email || student.uid}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={addingUid === student.uid}
                        onClick={() => handleAddStudent(student.uid)}
                        className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {addingUid === student.uid ? "Adding..." : "Add"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {shiftStudent && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                Shift student
              </h2>
              <button
                type="button"
                onClick={() => setShiftStudent(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-violet-50"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm text-slate-600">
                Move {studentLabel(shiftStudent)} to another batch of this course.
              </p>
              {courseBatches.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No other active batches exist for this course.
                </p>
              ) : (
                <select
                  value={shiftTarget}
                  onChange={(event) => setShiftTarget(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
                >
                  {courseBatches.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShiftStudent(null)}
                  className="rounded-xl px-4 py-2.5 text-sm text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!shiftTarget || shifting}
                  onClick={handleShift}
                  className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {shifting ? "Shifting..." : "Shift student"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
