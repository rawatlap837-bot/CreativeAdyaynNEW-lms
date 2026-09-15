import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
  Eye,
  X,
  CreditCard,
  BookOpen,
  RefreshCw,
  Mail,
  CalendarDays,
  ShieldCheck,
  GraduationCap,
} from "lucide-react";

import {
  collection,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";

import { db } from "../firebase/Firebase";

import {
  AT,
  Pill,
  Card,
  Modal,
  Field,
  PrimaryButton,
  GhostButton,
  EmptyState,
  ConfirmDeleteModal,
} from "./AdminUI";

import { TableRowSkeleton } from "../components/Skeleton";

/* ================================================================
   COLLECTIONS
================================================================ */

const COLLECTIONS = {
  users: "users",
  students: "students",
  enrollments: "enrollments",
  payments: "payments",
  courses: "courses",
};

/* ================================================================
   DATE HELPERS
================================================================ */

function toDate(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  const d = new Date(value);

  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value) {
  const date = toDate(value);

  if (!date) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* ================================================================
   PAYMENT HELPERS
================================================================ */

function isSuccessfulPayment(payment) {
  const status = String(payment?.status || "").toLowerCase();

  /*
   * If status does not exist, preserve compatibility with
   * your existing payment records.
   */
  if (!status) return true;

  return [
    "success",
    "successful",
    "paid",
    "completed",
    "captured",
  ].includes(status);
}

function getPaymentAmount(payment) {
  return (
    Number(
      payment?.amount ??
      payment?.amountPaid ??
      payment?.total ??
      payment?.price ??
      0
    ) || 0
  );
}

/* ================================================================
   STUDENT NAME
================================================================ */

function getStudentName(student) {
  return (
    student?.name ||
    student?.fullName ||
    student?.displayName ||
    student?.studentName ||
    "Unnamed student"
  );
}

/* ================================================================
   STUDENT EMAIL
================================================================ */

function getStudentEmail(student) {
  return (
    student?.email ||
    student?.emailAddress ||
    "No email"
  );
}

/* ================================================================
   COURSE NAME
================================================================ */

function getCourseName(course) {
  return (
    course?.title ||
    course?.name ||
    course?.courseName ||
    "Unknown course"
  );
}

/* ==================================================================
   ADMIN STUDENTS
================================================================== */

export default function Students() {
  const [users, setUsers] = useState([]);
  const [legacyStudents, setLegacyStudents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [courses, setCourses] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [query, setQuery] = useState("");

  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  /* ================================================================
     FIRESTORE LIVE DATA
  ================================================================ */

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribers = [];

    /*
     * ---------------------------------------------------------------
     * USERS
     * ---------------------------------------------------------------
     *
     * This is the main source of truth for authenticated users.
     */

    unsubscribers.push(
      onSnapshot(
        collection(db, COLLECTIONS.users),
        (snapshot) => {
          const data = snapshot.docs
            .map((item) => ({
              id: item.id,
              ...item.data(),
            }))
            .filter(
              (user) =>
                String(user.role || "").toLowerCase() ===
                "student"
            );

          setUsers(data);
        },
        (err) => {
          console.error("[users]", err);
          setError(err.message);
        }
      )
    );

    /*
     * ---------------------------------------------------------------
     * LEGACY STUDENTS
     * ---------------------------------------------------------------
     *
     * Kept because your current LMS already has a students
     * collection.
     */

    unsubscribers.push(
      onSnapshot(
        collection(db, COLLECTIONS.students),
        (snapshot) => {
          const data = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }));

          setLegacyStudents(data);
        },
        (err) => {
          console.error("[students]", err);
          setError(err.message);
        }
      )
    );

    /*
     * ---------------------------------------------------------------
     * ENROLLMENTS
     * ---------------------------------------------------------------
     */

    unsubscribers.push(
      onSnapshot(
        collection(db, COLLECTIONS.enrollments),
        (snapshot) => {
          const data = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }));

          setEnrollments(data);
        },
        (err) => {
          console.error("[enrollments]", err);
          setError(err.message);
        }
      )
    );

    /*
     * ---------------------------------------------------------------
     * PAYMENTS
     * ---------------------------------------------------------------
     */

    unsubscribers.push(
      onSnapshot(
        collection(db, COLLECTIONS.payments),
        (snapshot) => {
          const data = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }));

          setPayments(data);
        },
        (err) => {
          console.error("[payments]", err);
          setError(err.message);
        }
      )
    );

    /*
     * ---------------------------------------------------------------
     * COURSES
     * ---------------------------------------------------------------
     */

    unsubscribers.push(
      onSnapshot(
        collection(db, COLLECTIONS.courses),
        (snapshot) => {
          const data = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }));

          setCourses(data);
        },
        (err) => {
          console.error("[courses]", err);
          setError(err.message);
        }
      )
    );

    setLoading(false);

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [refreshKey]);

  /* ================================================================
     BUILD REAL STUDENT LIST
  ================================================================ */

  const students = useMemo(() => {
    const map = new Map();

    /*
     * First use authenticated users.
     */

    users.forEach((user) => {
      map.set(user.id, {
        id: user.id,
        uid: user.id,
        ...user,
        source: "users",
      });
    });

    /*
     * Then merge legacy students.
     *
     * Existing authenticated user data remains primary.
     */

    legacyStudents.forEach((student) => {
      const existing = map.get(student.id);

      if (existing) {
        map.set(student.id, {
          ...student,
          ...existing,
          id: student.id,
          uid: existing.uid || student.uid || student.id,
          source: "users",
        });
      } else {
        map.set(student.id, {
          id: student.id,
          uid: student.uid || student.id,
          ...student,
          source: "students",
        });
      }
    });

    /*
     * Attach real enrollments/payments/courses.
     */

    return Array.from(map.values()).map((student) => {
      const uid = student.uid || student.id;

      const studentEnrollments = enrollments.filter(
        (enrollment) =>
          enrollment.uid === uid ||
          enrollment.studentId === uid
      );

      const studentPayments = payments.filter(
        (payment) =>
          payment.uid === uid ||
          payment.studentId === uid
      );

      const studentCourses = studentEnrollments
        .map((enrollment) => {
          const course = courses.find(
            (item) =>
              item.id === enrollment.courseId
          );

          return {
            ...enrollment,
            course,
          };
        })
        .filter(Boolean);

      const activeEnrollments =
        studentEnrollments.filter(
          (enrollment) =>
            enrollment.status === "active"
        );

      const successfulPayments =
        studentPayments.filter(
          isSuccessfulPayment
        );

      const totalPaid = successfulPayments.reduce(
        (sum, payment) =>
          sum + getPaymentAmount(payment),
        0
      );

      return {
        ...student,

        uid,

        name: getStudentName(student),

        email: getStudentEmail(student),

        studentEnrollments,

        studentPayments,

        studentCourses,

        activeEnrollments,

        totalPaid,

        courseCount: studentCourses.length,

        activeCourseCount:
          activeEnrollments.length,

        paymentCount:
          successfulPayments.length,
      };
    });
  }, [
    users,
    legacyStudents,
    enrollments,
    payments,
    courses,
  ]);

  /* ================================================================
     SEARCH
  ================================================================ */

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();

    if (!q) {
      return students;
    }

    return students.filter((student) => {
      const courseText =
        student.studentCourses
          ?.map((item) =>
            getCourseName(item.course)
          )
          .join(" ") || "";

      return (
        getStudentName(student)
          .toLowerCase()
          .includes(q) ||
        getStudentEmail(student)
          .toLowerCase()
          .includes(q) ||
        String(student.id)
          .toLowerCase()
          .includes(q) ||
        String(student.uid)
          .toLowerCase()
          .includes(q) ||
        courseText
          .toLowerCase()
          .includes(q)
      );
    });
  }, [students, query]);

  /* ================================================================
     STATS
  ================================================================ */

  const stats = useMemo(() => {
    const total = students.length;

    const active = students.filter(
      (student) =>
        String(student.status || "active")
          .toLowerCase() === "active"
    ).length;

    const blocked = students.filter(
      (student) =>
        String(student.status || "")
          .toLowerCase() === "blocked" ||
        String(student.status || "")
          .toLowerCase() === "suspended"
    ).length;

    const enrolled = students.filter(
      (student) =>
        student.activeCourseCount > 0
    ).length;

    return {
      total,
      active,
      blocked,
      enrolled,
    };
  }, [students]);

  /* ================================================================
     TOGGLE STATUS
  ================================================================ */

  async function toggleStatus(student) {
    setError(null);

    const currentStatus =
      String(student.status || "active")
        .toLowerCase();

    const nextStatus =
      currentStatus === "active"
        ? "blocked"
        : "active";

    try {
      /*
       * Update authenticated user profile.
       */

      if (student.source === "users") {
        await updateDoc(
          doc(db, COLLECTIONS.users, student.id),
          {
            status: nextStatus,
          }
        );
      }

      /*
       * Keep legacy student record synchronized
       * when one exists.
       */

      const legacyExists =
        legacyStudents.some(
          (item) => item.id === student.id
        );

      if (legacyExists) {
        await updateDoc(
          doc(
            db,
            COLLECTIONS.students,
            student.id
          ),
          {
            status: nextStatus,
          }
        );
      }
    } catch (err) {
      console.error("[toggleStatus]", err);
      setError(err.message);
    }
  }

  /* ================================================================
     EDIT STUDENT
  ================================================================ */

  async function saveStudent(form) {
    if (!form?.id) return;

    setSaving(true);
    setError(null);

    try {
      const update = {
        name: form.name?.trim() || "",
        fullName: form.name?.trim() || "",
        email: form.email?.trim() || "",
        phone: form.phone?.trim() || "",
        status: form.status || "active",
      };

      /*
       * Authenticated profile.
       */

      if (users.some((user) => user.id === form.id)) {
        await updateDoc(
          doc(db, COLLECTIONS.users, form.id),
          update
        );
      }

      /*
       * Legacy profile.
       */

      if (
        legacyStudents.some(
          (student) => student.id === form.id
        )
      ) {
        await updateDoc(
          doc(db, COLLECTIONS.students, form.id),
          {
            name: update.name,
            email: update.email,
            phone: update.phone,
            status: update.status,
          }
        );
      }

      setEditing(null);
    } catch (err) {
      console.error("[saveStudent]", err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  /* ================================================================
     DELETE
  ================================================================ */

  async function removeStudent(student) {
    setError(null);

    try {
      /*
       * Delete profile document.
       *
       * IMPORTANT:
       * This does NOT delete Firebase Authentication.
       * Authentication deletion requires Admin SDK /
       * Cloud Function.
       */

      if (
        users.some(
          (user) => user.id === student.id
        )
      ) {
        await deleteDoc(
          doc(
            db,
            COLLECTIONS.users,
            student.id
          )
        );
      }

      /*
       * Delete legacy student record if present.
       */

      if (
        legacyStudents.some(
          (item) => item.id === student.id
        )
      ) {
        await deleteDoc(
          doc(
            db,
            COLLECTIONS.students,
            student.id
          )
        );
      }

      setConfirmDelete(null);
      setViewing(null);
    } catch (err) {
      console.error("[removeStudent]", err);
      setError(err.message);
    }
  }

  /* ================================================================
     REFRESH
  ================================================================ */

  function refreshData() {
    setRefreshKey((value) => value + 1);
  }

  /* ================================================================
     UI
  ================================================================ */

  return (
    <div className="w-full min-w-0 overflow-x-hidden">
      <Card title={null} action={null}>
        {/* ========================================================
            ERROR
        ======================================================== */}

        {error && (
          <div
            className="mx-3 mt-3 flex items-start gap-3 rounded-lg px-3 py-2.5 text-xs sm:mx-4 sm:text-sm"
            style={{
              background: "#fdecea",
              color: "#b3261e",
            }}
          >
            <span className="min-w-0 flex-1 break-words">
              {error}
            </span>

            <button
              type="button"
              onClick={() => setError(null)}
              className="shrink-0 rounded p-1"
              aria-label="Close error"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* ========================================================
            QUICK STATS
        ======================================================== */}

        <div className="grid grid-cols-2 gap-3 border-b p-3 sm:grid-cols-4 sm:p-4">
          <MiniStat
            label="Total students"
            value={stats.total}
            icon={GraduationCap}
          />

          <MiniStat
            label="Active"
            value={stats.active}
            icon={UserCheck}
          />

          <MiniStat
            label="Blocked"
            value={stats.blocked}
            icon={UserX}
          />

          <MiniStat
            label="Enrolled"
            value={stats.enrolled}
            icon={BookOpen}
          />
        </div>

        {/* ========================================================
            TOOLBAR
        ======================================================== */}

        <div
          className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:p-4"
          style={{
            borderColor: AT.line,
          }}
        >
          <div
            className="flex min-w-0 w-full items-center gap-2 rounded-lg border px-3 py-2 sm:flex-1"
            style={{
              borderColor: AT.line,
            }}
          >
            <Search
              size={15}
              color={AT.sub}
              className="shrink-0"
            />

            <input
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Search name, email, ID or course…"
              className="min-w-0 w-full bg-transparent text-sm outline-none"
            />

            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="shrink-0"
              >
                <X size={14} color={AT.sub} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={refreshData}
            className="flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm"
            style={{
              borderColor: AT.line,
              color: AT.ink,
            }}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>

        {/* ========================================================
            RESULT INFO
        ======================================================== */}

        <div className="px-3 py-2.5 text-xs sm:px-4">
          <span style={{ color: AT.sub }}>
            Showing{" "}
            <strong style={{ color: AT.ink }}>
              {filtered.length}
            </strong>{" "}
            of{" "}
            <strong style={{ color: AT.ink }}>
              {students.length}
            </strong>{" "}
            students
          </span>
        </div>

        {/* ========================================================
            MOBILE
        ======================================================== */}

        <div className="block sm:hidden">
          {loading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 5 }).map(
                (_, index) => (
                  <div
                    key={index}
                    className="animate-pulse rounded-xl border p-4"
                    style={{
                      borderColor: AT.line,
                    }}
                  >
                    <div className="h-4 w-2/3 rounded bg-slate-200" />
                    <div className="mt-2 h-3 w-4/5 rounded bg-slate-200" />
                    <div className="mt-4 h-3 w-1/2 rounded bg-slate-200" />
                  </div>
                )
              )}
            </div>
          ) : filtered.length > 0 ? (
            <div className="space-y-2 p-3">
              {filtered.map((student) => (
                <MobileStudentCard
                  key={student.id}
                  student={student}
                  onView={() =>
                    setViewing(student)
                  }
                  onToggle={() =>
                    toggleStatus(student)
                  }
                  onEdit={() =>
                    setEditing(student)
                  }
                  onDelete={() =>
                    setConfirmDelete(student)
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState
              text={
                query
                  ? "No students match your search."
                  : "No student accounts found."
              }
            />
          )}
        </div>

        {/* ========================================================
            DESKTOP TABLE
        ======================================================== */}

        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr
                className="border-t text-left"
                style={{
                  borderColor: AT.line,
                  color: AT.sub,
                }}
              >
                <th className="px-4 py-3 font-medium">
                  Student
                </th>

                <th className="px-4 py-3 font-medium">
                  Courses
                </th>

                <th className="px-4 py-3 font-medium">
                  Paid
                </th>

                <th className="px-4 py-3 font-medium">
                  Status
                </th>

                <th className="px-4 py-3 font-medium">
                  Joined
                </th>

                <th className="px-4 py-3 text-right font-medium">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map(
                  (_, index) => (
                    <TableRowSkeleton
                      key={index}
                      columns={6}
                    />
                  )
                )
              ) : filtered.length > 0 ? (
                filtered.map((student) => (
                  <DesktopStudentRow
                    key={student.id}
                    student={student}
                    onView={() =>
                      setViewing(student)
                    }
                    onToggle={() =>
                      toggleStatus(student)
                    }
                    onEdit={() =>
                      setEditing(student)
                    }
                    onDelete={() =>
                      setConfirmDelete(student)
                    }
                  />
                ))
              ) : null}
            </tbody>
          </table>

          {!loading &&
            filtered.length === 0 && (
              <EmptyState
                text={
                  query
                    ? "No students match your search."
                    : "No student accounts found."
                }
              />
            )}
        </div>

        {/* ========================================================
            EDIT
        ======================================================== */}

        {editing && (
          <StudentEditModal
            student={editing}
            saving={saving}
            onCancel={() =>
              setEditing(null)
            }
            onSave={saveStudent}
          />
        )}

        {/* ========================================================
            DETAILS
        ======================================================== */}

        {viewing && (
          <StudentDetail
            student={viewing}
            onClose={() =>
              setViewing(null)
            }
            onEdit={() => {
              setEditing(viewing);
              setViewing(null);
            }}
            onDelete={() =>
              setConfirmDelete(viewing)
            }
          />
        )}

        {/* ========================================================
            DELETE
        ======================================================== */}

        {confirmDelete && (
          <ConfirmDeleteModal
            name={getStudentName(confirmDelete)}
            onCancel={() =>
              setConfirmDelete(null)
            }
            onConfirm={() =>
              removeStudent(confirmDelete)
            }
          />
        )}
      </Card>
    </div>
  );
}

/* ==================================================================
   MINI STAT
================================================================== */

function MiniStat({
  label,
  value,
  icon: Icon,
}) {
  return (
    <div
      className="min-w-0 rounded-xl border p-3"
      style={{
        borderColor: AT.line,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="truncate text-xs"
          style={{
            color: AT.sub,
          }}
        >
          {label}
        </span>

        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{
            background: AT.accentSoft,
            color: AT.accentDeep,
          }}
        >
          <Icon size={15} />
        </div>
      </div>

      <p
        className="mt-2 text-xl font-semibold"
        style={{
          color: AT.ink,
        }}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}

/* ==================================================================
   DESKTOP ROW
================================================================== */

function DesktopStudentRow({
  student,
  onView,
  onToggle,
  onEdit,
  onDelete,
}) {
  return (
    <tr
      className="cursor-pointer border-t transition-colors hover:bg-black/[0.02]"
      style={{
        borderColor: AT.line,
      }}
      onClick={onView}
    >
      {/* Student */}

      <td className="max-w-[300px] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar student={student} />

          <div className="min-w-0">
            <p
              className="truncate font-medium"
              style={{
                color: AT.ink,
              }}
            >
              {getStudentName(student)}
            </p>

            <p
              className="mt-0.5 truncate text-xs"
              style={{
                color: AT.sub,
              }}
            >
              {getStudentEmail(student)}
            </p>
          </div>
        </div>
      </td>

      {/* Courses */}

      <td className="px-4 py-3">
        <div className="max-w-[230px]">
          <p
            className="font-medium"
            style={{
              color: AT.ink,
            }}
          >
            {student.courseCount}
          </p>

          <p
            className="truncate text-xs"
            style={{
              color: AT.sub,
            }}
          >
            {student.studentCourses
              ?.slice(0, 2)
              .map((item) =>
                getCourseName(item.course)
              )
              .join(", ") ||
              "No enrolled courses"}
          </p>
        </div>
      </td>

      {/* Paid */}

      <td className="px-4 py-3">
        <p
          className="font-medium"
          style={{
            color: AT.ink,
          }}
        >
          ₹
          {student.totalPaid.toLocaleString(
            "en-IN"
          )}
        </p>

        <p
          className="text-xs"
          style={{
            color: AT.sub,
          }}
        >
          {student.paymentCount} payment
          {student.paymentCount === 1
            ? ""
            : "s"}
        </p>
      </td>

      {/* Status */}

      <td className="px-4 py-3">
        <Pill
          tone={
            student.status || "active"
          }
        />
      </td>

      {/* Joined */}

      <td className="px-4 py-3">
        <span
          className="text-xs"
          style={{
            color: AT.sub,
          }}
        >
          {formatDate(
            student.createdAt ||
            student.joinedAt ||
            student.enrolledAt
          )}
        </span>
      </td>

      {/* Actions */}

      <td className="px-4 py-3">
        <div
          className="flex justify-end gap-2"
          onClick={(event) =>
            event.stopPropagation()
          }
        >
          <ActionButton
            title="View details"
            onClick={onView}
          >
            <Eye size={16} />
          </ActionButton>

          <ActionButton
            title={
              student.status === "active"
                ? "Block student"
                : "Activate student"
            }
            onClick={onToggle}
          >
            {student.status === "active" ? (
              <UserX size={16} />
            ) : (
              <UserCheck size={16} />
            )}
          </ActionButton>

          <ActionButton
            title="Edit student"
            onClick={onEdit}
          >
            <Pencil size={16} />
          </ActionButton>

          <ActionButton
            title="Delete student"
            onClick={onDelete}
            danger
          >
            <Trash2 size={16} />
          </ActionButton>
        </div>
      </td>
    </tr>
  );
}

/* ==================================================================
   MOBILE CARD
================================================================== */

function MobileStudentCard({
  student,
  onView,
  onToggle,
  onEdit,
  onDelete,
}) {
  return (
    <div
      className="rounded-xl border p-3.5"
      style={{
        borderColor: AT.line,
      }}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Avatar student={student} />

        <div className="min-w-0 flex-1">
          <p
            className="break-words text-sm font-semibold"
            style={{
              color: AT.ink,
            }}
          >
            {getStudentName(student)}
          </p>

          <p
            className="mt-0.5 break-all text-xs"
            style={{
              color: AT.sub,
            }}
          >
            {getStudentEmail(student)}
          </p>
        </div>

        <Pill
          tone={
            student.status || "active"
          }
        />
      </div>

      <div
        className="mt-3 grid grid-cols-2 gap-2 rounded-lg p-3"
        style={{
          background: AT.canvas,
        }}
      >
        <InfoBlock
          label="Courses"
          value={student.courseCount}
        />

        <InfoBlock
          label="Paid"
          value={`₹${student.totalPaid.toLocaleString(
            "en-IN"
          )}`}
        />

        <InfoBlock
          label="Active courses"
          value={student.activeCourseCount}
        />

        <InfoBlock
          label="Joined"
          value={formatDate(
            student.createdAt ||
            student.joinedAt
          )}
        />
      </div>

      <div
        className="mt-3 grid grid-cols-4 gap-2"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <MobileActionButton
          label="View"
          onClick={onView}
        >
          <Eye size={15} />
        </MobileActionButton>

        <MobileActionButton
          label={
            student.status === "active"
              ? "Block"
              : "Activate"
          }
          onClick={onToggle}
        >
          {student.status === "active" ? (
            <UserX size={15} />
          ) : (
            <UserCheck size={15} />
          )}
        </MobileActionButton>

        <MobileActionButton
          label="Edit"
          onClick={onEdit}
        >
          <Pencil size={15} />
        </MobileActionButton>

        <MobileActionButton
          label="Delete"
          onClick={onDelete}
          danger
        >
          <Trash2 size={15} />
        </MobileActionButton>
      </div>
    </div>
  );
}

/* ==================================================================
   AVATAR
================================================================== */

function Avatar({ student }) {
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
      style={{
        background: AT.accentSoft,
        color: AT.accentDeep,
      }}
    >
      {getStudentName(student)
        .trim()
        .charAt(0)
        .toUpperCase() || "S"}
    </div>
  );
}

/* ==================================================================
   INFO BLOCK
================================================================== */

function InfoBlock({
  label,
  value,
}) {
  return (
    <div className="min-w-0">
      <p
        className="text-[11px]"
        style={{
          color: AT.sub,
        }}
      >
        {label}
      </p>

      <p
        className="mt-0.5 truncate text-xs font-medium"
        style={{
          color: AT.ink,
        }}
      >
        {value}
      </p>
    </div>
  );
}

/* ==================================================================
   ACTION BUTTON
================================================================== */

function ActionButton({
  children,
  onClick,
  title,
  danger = false,
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-black/5"
      style={{
        color: danger
          ? AT.danger
          : AT.sub,
      }}
    >
      {children}
    </button>
  );
}

/* ==================================================================
   MOBILE ACTION
================================================================== */

function MobileActionButton({
  children,
  label,
  onClick,
  danger = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[42px] min-w-0 flex-col items-center justify-center gap-1 rounded-lg border text-[10px] font-medium"
      style={{
        borderColor: AT.line,
        color: danger
          ? AT.danger
          : AT.sub,
      }}
    >
      {children}

      <span className="truncate">
        {label}
      </span>
    </button>
  );
}

/* ==================================================================
   EDIT MODAL
================================================================== */

function StudentEditModal({
  student,
  saving,
  onCancel,
  onSave,
}) {
  const [form, setForm] = useState({
    id: student.id,
    name: getStudentName(student),
    email: getStudentEmail(student),
    phone: student.phone || "",
    status: student.status || "active",
  });

  return (
    <Modal
      title="Edit student"
      onClose={onCancel}
    >
      <div className="space-y-1">
        <Field
          label="Full name"
          value={form.name}
          onChange={(event) =>
            setForm({
              ...form,
              name: event.target.value,
            })
          }
        />

        <Field
          label="Email"
          value={form.email}
          onChange={(event) =>
            setForm({
              ...form,
              email: event.target.value,
            })
          }
        />

        <Field
          label="Phone"
          value={form.phone}
          onChange={(event) =>
            setForm({
              ...form,
              phone: event.target.value,
            })
          }
        />

        <div className="mt-3">
          <label
            className="mb-1.5 block text-xs font-medium"
            style={{
              color: AT.sub,
            }}
          >
            Account status
          </label>

          <select
            value={form.status}
            onChange={(event) =>
              setForm({
                ...form,
                status: event.target.value,
              })
            }
            className="w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none"
            style={{
              borderColor: AT.line,
              color: AT.ink,
            }}
          >
            <option value="active">
              Active
            </option>

            <option value="blocked">
              Blocked
            </option>

            <option value="suspended">
              Suspended
            </option>
          </select>
        </div>
      </div>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <GhostButton
          onClick={onCancel}
          className="w-full justify-center sm:w-auto"
        >
          Cancel
        </GhostButton>

        <PrimaryButton
          disabled={
            saving ||
            !form.name.trim()
          }
          onClick={() =>
            form.name.trim() &&
            onSave(form)
          }
          className="w-full justify-center sm:w-auto"
        >
          {saving
            ? "Saving…"
            : "Save changes"}
        </PrimaryButton>
      </div>
    </Modal>
  );
}

/* ==================================================================
   STUDENT DETAIL
================================================================== */

function StudentDetail({
  student,
  onClose,
  onEdit,
  onDelete,
}) {
  return (
    <Modal
      title="Student details"
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* Profile */}

        <div
          className="rounded-xl border p-4"
          style={{
            borderColor: AT.line,
          }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Avatar student={student} />

            <div className="min-w-0 flex-1">
              <p
                className="break-words text-base font-semibold"
                style={{
                  color: AT.ink,
                }}
              >
                {getStudentName(student)}
              </p>

              <div className="mt-1 flex min-w-0 items-center gap-1.5">
                <Mail
                  size={13}
                  color={AT.sub}
                  className="shrink-0"
                />

                <p
                  className="break-all text-sm"
                  style={{
                    color: AT.sub,
                  }}
                >
                  {getStudentEmail(student)}
                </p>
              </div>
            </div>

            <Pill
              tone={
                student.status || "active"
              }
            />
          </div>
        </div>

        {/* Basic information */}

        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <DetailRow
            label="Student ID"
            value={student.id}
          />

          <DetailRow
            label="Firebase UID"
            value={student.uid}
          />

          <DetailRow
            label="Phone"
            value={student.phone || "—"}
          />

          <DetailRow
            label="Joined"
            value={formatDate(
              student.createdAt ||
              student.joinedAt
            )}
          />

          <DetailRow
            label="Enrolled courses"
            value={student.courseCount}
          />

          <DetailRow
            label="Active courses"
            value={
              student.activeCourseCount
            }
          />

          <DetailRow
            label="Total paid"
            value={`₹${student.totalPaid.toLocaleString(
              "en-IN"
            )}`}
          />

          <DetailRow
            label="Payments"
            value={student.paymentCount}
          />
        </div>

        {/* Courses */}

        <section>
          <div className="mb-2 flex items-center gap-2">
            <BookOpen
              size={15}
              color={AT.accentDeep}
            />

            <p
              className="text-sm font-medium"
              style={{
                color: AT.ink,
              }}
            >
              Enrolled courses
            </p>
          </div>

          {student.studentCourses?.length ? (
            <div
              className="divide-y overflow-hidden rounded-lg border"
              style={{
                borderColor: AT.line,
              }}
            >
              {student.studentCourses.map(
                (enrollment, index) => (
                  <div
                    key={
                      enrollment.id ||
                      `${enrollment.courseId}-${index}`
                    }
                    className="flex items-center justify-between gap-3 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p
                        className="truncate text-sm font-medium"
                        style={{
                          color: AT.ink,
                        }}
                      >
                        {getCourseName(
                          enrollment.course
                        )}
                      </p>

                      <p
                        className="mt-0.5 text-xs"
                        style={{
                          color: AT.sub,
                        }}
                      >
                        {enrollment.courseId ||
                          "No course ID"}
                      </p>
                    </div>

                    <Pill
                      tone={
                        enrollment.status ||
                        "unknown"
                      }
                    />
                  </div>
                )
              )}
            </div>
          ) : (
            <div
              className="rounded-lg border p-3 text-sm"
              style={{
                borderColor: AT.line,
                color: AT.sub,
              }}
            >
              No enrollment records found.
            </div>
          )}
        </section>

        {/* Payments */}

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CreditCard
                size={15}
                color={AT.accentDeep}
              />

              <p
                className="text-sm font-medium"
                style={{
                  color: AT.ink,
                }}
              >
                Payment history
              </p>
            </div>

            <p
              className="text-xs font-medium"
              style={{
                color: AT.ink,
              }}
            >
              ₹
              {student.totalPaid.toLocaleString(
                "en-IN"
              )}
            </p>
          </div>

          {student.studentPayments?.length ? (
            <div
              className="divide-y overflow-hidden rounded-lg border"
              style={{
                borderColor: AT.line,
              }}
            >
              {student.studentPayments
                .slice()
                .sort(
                  (a, b) =>
                    (
                      toDate(
                        b.paidAt ||
                        b.createdAt
                      ) || 0
                    ) -
                    (
                      toDate(
                        a.paidAt ||
                        a.createdAt
                      ) || 0
                    )
                )
                .map((payment) => (
                  <div
                    key={payment.id}
                    className="flex flex-col gap-1 px-3 py-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between"
                  >
                    <div className="min-w-0">
                      <p
                        className="break-words text-sm font-medium"
                        style={{
                          color: AT.ink,
                        }}
                      >
                        ₹
                        {getPaymentAmount(
                          payment
                        ).toLocaleString(
                          "en-IN"
                        )}
                      </p>

                      <p
                        className="mt-0.5 break-all text-xs"
                        style={{
                          color: AT.sub,
                        }}
                      >
                        {payment.courseName ||
                          payment.courseId ||
                          "Course not specified"}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Pill
                        tone={
                          payment.status ||
                          "recorded"
                        }
                      />

                      <span
                        className="text-xs"
                        style={{
                          color: AT.sub,
                        }}
                      >
                        {formatDate(
                          payment.paidAt ||
                          payment.createdAt
                        )}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div
              className="rounded-lg border p-3 text-sm"
              style={{
                borderColor: AT.line,
                color: AT.sub,
              }}
            >
              No payment records found.
            </div>
          )}
        </section>

        {/* Footer */}

        <div
          className="flex flex-col-reverse gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between"
          style={{
            borderColor: AT.line,
          }}
        >
          <button
            type="button"
            onClick={onDelete}
            className="w-full text-left text-sm sm:w-auto"
            style={{
              color: AT.danger,
            }}
          >
            Remove profile
          </button>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <GhostButton
              onClick={onClose}
              className="w-full justify-center sm:w-auto"
            >
              Close
            </GhostButton>

            <PrimaryButton
              onClick={onEdit}
              className="w-full justify-center sm:w-auto"
            >
              Edit
            </PrimaryButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ==================================================================
   DETAIL ROW
================================================================== */

function DetailRow({
  label,
  value,
}) {
  return (
    <div
      className="min-w-0 rounded-lg p-3"
      style={{
        background: AT.canvas,
      }}
    >
      <p
        className="text-[11px]"
        style={{
          color: AT.sub,
        }}
      >
        {label}
      </p>

      <p
        className="mt-0.5 break-words text-sm"
        style={{
          color: AT.ink,
        }}
      >
        {value ?? "—"}
      </p>
    </div>
  );
}