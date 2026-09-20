import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
} from "../lib/database";
import { onAuthStateChanged } from "../lib/auth";
import {
  CheckCircle2,
  Clock3,
  XCircle,
  Users,
  Search,
  RefreshCw,
  BookOpen,
  ClipboardCheck,
  CalendarDays,
} from "lucide-react";

import { auth, db } from "../lib/backend";
import { getCourseAttendance } from "../services/AttendanceService";

/* ============================================================
   DATE FORMAT
============================================================ */

function formatDate(value) {
  if (!value) return "—";

  if (value?.toDate) {
    return value.toDate().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* ============================================================
   STATUS CONFIG
============================================================ */

function statusConfig(status) {
  switch (status) {
    case "present":
      return {
        label: "Present",
        icon: CheckCircle2,
        className: "bg-emerald-50 text-emerald-700",
        dotClass: "bg-emerald-500",
      };

    case "late":
      return {
        label: "Late",
        icon: Clock3,
        className: "bg-amber-50 text-amber-700",
        dotClass: "bg-amber-500",
      };

    case "absent":
      return {
        label: "Absent",
        icon: XCircle,
        className: "bg-red-50 text-red-700",
        dotClass: "bg-red-500",
      };

    default:
      return {
        label: status || "Unknown",
        icon: Clock3,
        className: "bg-slate-100 text-slate-600",
        dotClass: "bg-slate-400",
      };
  }
}

/* ============================================================
   TEACHER ATTENDANCE
============================================================ */

export default function Attendance() {
  const [teacher, setTeacher] = useState(null);
  const [courses, setCourses] = useState([]);
  const [attendance, setAttendance] = useState([]);

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [attendanceLoading, setAttendanceLoading] =
    useState(false);

  const [error, setError] = useState("");

  /* ==========================================================
     AUTH
  ========================================================== */

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setTeacher(user || null);

        if (!user) {
          setCourses([]);
          setAttendance([]);
          setLoading(false);
        }
      }
    );

    return unsubscribe;
  }, []);

  /* ==========================================================
     LOAD TEACHER COURSES
     NOTE: this still runs in the background — it's how we know
     which course IDs to pull attendance for below. There's no
     dropdown or course-picking UI anymore, this just silently
     resolves the teacher's course IDs.
  ========================================================== */

  useEffect(() => {
    if (!teacher?.uid) return;

    let cancelled = false;

    async function loadCourses() {
      setLoading(true);
      setError("");

      try {
        const coursesQuery = query(
          collection(db, "courses"),
          where(
            "instructorId",
            "==",
            teacher.uid
          )
        );

        const snapshot =
          await getDocs(coursesQuery);

        if (cancelled) return;

        const courseList =
          snapshot.docs.map((courseDoc) => ({
            id: courseDoc.id,
            ...courseDoc.data(),
          }));

        setCourses(courseList);
      } catch (err) {
        console.error(
          "Failed to load teacher courses:",
          err
        );

        if (!cancelled) {
          setError(
            "Unable to load attendance."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCourses();

    return () => {
      cancelled = true;
    };
  }, [teacher]);

  /* ==========================================================
     LOAD ATTENDANCE (always all of the teacher's courses)
  ========================================================== */

  useEffect(() => {
    if (!teacher?.uid) return;

    if (courses.length === 0) {
      setAttendance([]);
      setAttendanceLoading(false);
      return;
    }

    let cancelled = false;

    async function loadAttendance() {
      setAttendanceLoading(true);
      setError("");

      try {
        const results =
          await Promise.all(
            courses.map((course) =>
              getCourseAttendance(
                course.id
              )
            )
          );

        const records = results.flat();

        if (cancelled) return;

        const courseMap = new Map(
          courses.map((course) => [
            course.id,
            course,
          ])
        );

        const enriched =
          records.map((record) => ({
            ...record,

            course:
              courseMap.get(
                record.courseId
              ) || null,
          }));

        setAttendance(enriched);
      } catch (err) {
        console.error(
          "Failed to load attendance:",
          err
        );

        if (!cancelled) {
          setError(
            "Unable to load attendance records."
          );
        }
      } finally {
        if (!cancelled) {
          setAttendanceLoading(false);
        }
      }
    }

    loadAttendance();

    return () => {
      cancelled = true;
    };
  }, [
    teacher,
    courses,
  ]);

  /* ==========================================================
     SEARCH
  ========================================================== */

  const filteredAttendance =
    useMemo(() => {
      const term =
        search.trim().toLowerCase();

      if (!term) {
        return attendance;
      }

      return attendance.filter(
        (record) => {
          const courseName =
            record.course?.title ||
            record.course?.name ||
            "";

          return (
            record.studentId
              ?.toLowerCase()
              .includes(term) ||
            courseName
              .toLowerCase()
              .includes(term) ||
            record.status
              ?.toLowerCase()
              .includes(term) ||
            record.sessionId
              ?.toLowerCase()
              .includes(term)
          );
        }
      );
    }, [attendance, search]);

  /* ==========================================================
     SUMMARY
  ========================================================== */

  const totalRecords =
    filteredAttendance.length;

  const presentCount =
    filteredAttendance.filter(
      (item) =>
        item.status === "present"
    ).length;

  const lateCount =
    filteredAttendance.filter(
      (item) =>
        item.status === "late"
    ).length;

  const absentCount =
    filteredAttendance.filter(
      (item) =>
        item.status === "absent"
    ).length;

  /* ==========================================================
     REFRESH
  ========================================================== */

  const refreshAttendance =
    async () => {
      if (!teacher?.uid) return;

      setAttendanceLoading(true);
      setError("");

      try {
        const results =
          await Promise.all(
            courses.map((course) =>
              getCourseAttendance(
                course.id
              )
            )
          );

        const records = results.flat();

        const courseMap = new Map(
          courses.map((course) => [
            course.id,
            course,
          ])
        );

        setAttendance(
          records.map((record) => ({
            ...record,

            course:
              courseMap.get(
                record.courseId
              ) || null,
          }))
        );
      } catch (err) {
        console.error(
          "Failed to refresh attendance:",
          err
        );

        setError(
          "Unable to refresh attendance."
        );
      } finally {
        setAttendanceLoading(false);
      }
    };

  /* ==========================================================
     AUTH FALLBACK
  ========================================================== */

  if (!teacher) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
          <ClipboardCheck className="h-5 w-5" />
        </div>

        <p className="mt-4 text-sm font-semibold text-slate-700">
          Please log in to view attendance.
        </p>
      </div>
    );
  }

  /* ==========================================================
     UI
  ========================================================== */

  return (
    <div className="w-full max-w-full space-y-4 overflow-x-hidden px-3 py-3 sm:space-y-6 sm:px-4 sm:py-4 lg:px-6 lg:py-6 xl:px-8">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-6">

        <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">

          {/* TITLE */}

          <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 sm:h-11 sm:w-11">
              <ClipboardCheck className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>

            <div className="min-w-0">

              <h1 className="text-base font-bold tracking-tight text-slate-900 sm:text-xl">
                Attendance
              </h1>

              <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
                Monitor attendance for your courses.
              </p>

            </div>

          </div>

          {/* REFRESH */}

          <button
            type="button"
            onClick={refreshAttendance}
            disabled={attendanceLoading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            <RefreshCw
              className={`h-4 w-4 shrink-0 ${attendanceLoading
                ? "animate-spin"
                : ""
                }`}
            />

            <span>
              {attendanceLoading
                ? "Refreshing..."
                : "Refresh"}
            </span>
          </button>

        </div>

      </div>

      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-5 text-red-700">
          {error}
        </div>
      )}

      {/* ======================================================
          SUMMARY
      ====================================================== */}

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">

        <SummaryCard
          label="Total"
          value={totalRecords}
          icon={Users}
        />

        <SummaryCard
          label="Present"
          value={presentCount}
          icon={CheckCircle2}
          iconClass="bg-emerald-50 text-emerald-600"
        />

        <SummaryCard
          label="Late"
          value={lateCount}
          icon={Clock3}
          iconClass="bg-amber-50 text-amber-600"
        />

        <SummaryCard
          label="Absent"
          value={absentCount}
          icon={XCircle}
          iconClass="bg-red-50 text-red-600"
        />

      </div>

      {/* ======================================================
          SEARCH
      ====================================================== */}

      <div className="relative">

        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 sm:left-4" />

        <input
          type="text"
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          placeholder="Search student, course, session..."
          className="w-full min-w-0 rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-medium text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 sm:pl-11"
        />

      </div>

      {/* ======================================================
          MOBILE ATTENDANCE CARDS
      ====================================================== */}

      <div className="space-y-3 lg:hidden">

        {loading ||
          attendanceLoading ? (
          <LoadingState />
        ) : filteredAttendance.length ===
          0 ? (
          <EmptyState />
        ) : (
          filteredAttendance.map(
            (record) => (
              <MobileAttendanceCard
                key={record.id}
                record={record}
              />
            )
          )
        )}

      </div>

      {/* ======================================================
          DESKTOP TABLE
      ====================================================== */}

      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">

        <div className="overflow-x-auto">

          <table className="w-full min-w-[760px] text-left">

            {/* HEADER */}

            <thead>

              <tr className="border-b border-slate-200 bg-slate-50">

                <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Student
                </th>

                <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Course
                </th>

                <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Session
                </th>

                <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>

                <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Marked
                </th>

              </tr>

            </thead>

            {/* BODY */}

            <tbody>

              {loading ||
                attendanceLoading ? (

                <tr>
                  <td
                    colSpan="5"
                    className="px-5 py-14 text-center"
                  >
                    <LoadingState
                      bordered={false}
                    />
                  </td>
                </tr>

              ) : filteredAttendance.length ===
                0 ? (

                <tr>
                  <td
                    colSpan="5"
                    className="px-5 py-14 text-center"
                  >
                    <EmptyState
                      bordered={false}
                    />
                  </td>
                </tr>

              ) : (

                filteredAttendance.map(
                  (record) => (
                    <DesktopAttendanceRow
                      key={record.id}
                      record={record}
                    />
                  )
                )

              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}

/* ============================================================
   MOBILE ATTENDANCE CARD
============================================================ */

function MobileAttendanceCard({
  record,
}) {
  const config =
    statusConfig(record.status);

  const StatusIcon =
    config.icon;

  const courseName =
    record.course?.title ||
    record.course?.name ||
    record.courseId ||
    "Unknown course";

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

      {/* TOP */}

      <div className="flex items-start justify-between gap-2.5 border-b border-slate-100 p-3.5 sm:gap-3 sm:p-4">

        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 sm:h-10 sm:w-10">
            <Users className="h-4 w-4" />
          </div>

          <div className="min-w-0">

            <p className="truncate text-sm font-bold text-slate-900">
              {record.studentId ||
                "Unknown student"}
            </p>

            <p className="mt-0.5 text-xs text-slate-500">
              Student ID
            </p>

          </div>

        </div>

        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold ${config.className}`}
        >
          <StatusIcon className="h-3.5 w-3.5" />
          {config.label}
        </span>

      </div>

      {/* DETAILS */}

      <div className="space-y-3 p-3.5 sm:p-4">

        {/* COURSE */}

        <div className="flex items-start gap-2.5 sm:gap-3">

          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />

          <div className="min-w-0">

            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Course
            </p>

            <p className="mt-0.5 break-words text-sm font-medium text-slate-700">
              {courseName}
            </p>

          </div>

        </div>

        {/* SESSION */}

        <div className="flex items-start gap-2.5 sm:gap-3">

          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />

          <div className="min-w-0">

            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Session
            </p>

            <p className="mt-0.5 break-all text-xs font-medium text-slate-600">
              {record.sessionId ||
                "—"}
            </p>

          </div>

        </div>

        {/* DATE */}

        <div className="flex items-start gap-2.5 sm:gap-3">

          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />

          <div className="min-w-0">

            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Marked
            </p>

            <p className="mt-0.5 text-sm font-medium text-slate-700">
              {formatDate(
                record.markedAt
              )}
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}

/* ============================================================
   DESKTOP TABLE ROW
============================================================ */

function DesktopAttendanceRow({
  record,
}) {
  const config =
    statusConfig(record.status);

  const StatusIcon =
    config.icon;

  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">

      {/* STUDENT */}

      <td className="px-5 py-4">

        <p className="text-sm font-semibold text-slate-900">
          {record.studentId ||
            "Unknown student"}
        </p>

      </td>

      {/* COURSE */}

      <td className="px-5 py-4">

        <p className="max-w-[260px] truncate text-sm font-medium text-slate-700">
          {record.course?.title ||
            record.course?.name ||
            record.courseId ||
            "Unknown course"}
        </p>

      </td>

      {/* SESSION */}

      <td className="px-5 py-4">

        <p
          title={record.sessionId}
          className="max-w-[220px] truncate text-xs font-medium text-slate-500"
        >
          {record.sessionId || "—"}
        </p>

      </td>

      {/* STATUS */}

      <td className="px-5 py-4">

        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold ${config.className}`}
        >

          <StatusIcon className="h-3.5 w-3.5" />

          {config.label}

        </span>

      </td>

      {/* DATE */}

      <td className="px-5 py-4">

        <p className="text-xs font-medium text-slate-500">
          {formatDate(
            record.markedAt
          )}
        </p>

      </td>

    </tr>
  );
}

/* ============================================================
   LOADING STATE
============================================================ */

function LoadingState({
  bordered = true,
}) {
  return (
    <div
      className={`rounded-2xl bg-white p-8 text-center sm:p-10 ${bordered
        ? "border border-slate-200 shadow-sm"
        : ""
        }`}
    >

      <div className="flex items-center justify-center gap-2 text-sm font-medium text-slate-500">

        <RefreshCw className="h-4 w-4 animate-spin" />

        <span>
          Loading attendance...
        </span>

      </div>

    </div>
  );
}

/* ============================================================
   EMPTY STATE
============================================================ */

function EmptyState({
  bordered = true,
}) {
  return (
    <div
      className={`rounded-2xl bg-white p-8 text-center sm:p-10 ${bordered
        ? "border border-slate-200 shadow-sm"
        : ""
        }`}
    >

      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
        <Users className="h-5 w-5" />
      </div>

      <p className="mt-4 text-sm font-semibold text-slate-900">
        No attendance records
      </p>

      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500 sm:text-sm">
        Attendance marked by students
        will appear here.
      </p>

    </div>
  );
}

/* ============================================================
   SUMMARY CARD
============================================================ */

function SummaryCard({
  label,
  value,
  icon: Icon,
  iconClass = "bg-violet-50 text-violet-600",
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-5">

      <div className="flex items-center justify-between gap-2">

        <div className="min-w-0">

          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
            {label}
          </p>

          <p className="mt-1.5 text-lg font-bold tracking-tight text-slate-900 sm:mt-2 sm:text-2xl">
            {value}
          </p>

        </div>

        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${iconClass}`}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>

      </div>

    </div>
  );
}