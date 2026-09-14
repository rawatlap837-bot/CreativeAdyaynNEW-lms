import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
  Eye,
  X,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
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

// Firestore collection names
const STUDENTS_COLLECTION = "students";
const PAYMENTS_COLLECTION = "payments";

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();

  const d = new Date(value);
  return isNaN(d) ? null : d;
}

export default function Students() {
  const [students, setStudents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, STUDENTS_COLLECTION),
      (snap) => {
        setStudents(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, PAYMENTS_COLLECTION),
      (snap) => {
        setPayments(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
      },
      (err) => setError(err.message)
    );

    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();

    if (!q) return students;

    return students.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.id?.toLowerCase().includes(q) ||
        s.course?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q)
    );
  }, [students, query]);

  async function toggleStatus(student) {
    try {
      await updateDoc(doc(db, STUDENTS_COLLECTION, student.id), {
        status: student.status === "active" ? "blocked" : "active",
      });
    } catch (err) {
      setError(err.message);
    }
  }

  async function save(form) {
    setSaving(true);

    try {
      if (form.id) {
        const { id, ...rest } = form;

        await updateDoc(doc(db, STUDENTS_COLLECTION, id), rest);
      } else {
        await addDoc(collection(db, STUDENTS_COLLECTION), {
          name: form.name,
          email: form.email,
          course: form.course,
          year: form.year,
          status: "active",
          fees: "due",
          createdAt: serverTimestamp(),
        });
      }

      setModal(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(student) {
    try {
      await deleteDoc(doc(db, STUDENTS_COLLECTION, student.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setConfirmDelete(null);
      setViewing(null);
    }
  }

  return (
    <div className="w-full min-w-0 overflow-x-hidden">
      <Card title={null} action={null}>
        {/* Error */}
        {error && (
          <div
            className="mx-3 mt-3 flex items-start gap-3 rounded-lg px-3 py-2.5 text-xs sm:mx-4 sm:text-sm"
            style={{
              background: "#fdecea",
              color: "#b3261e",
            }}
          >
            <span className="min-w-0 flex-1 break-words">
              {error}. Check the collection names at the top of this file
              and your Firestore security rules.
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

        {/* Toolbar */}
        <div
          className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:p-4"
          style={{ borderColor: AT.line }}
        >
          {/* Search */}
          <div
            className="flex min-w-0 w-full items-center gap-2 rounded-lg border px-3 py-2 sm:flex-1"
            style={{ borderColor: AT.line }}
          >
            <Search size={15} color={AT.sub} className="shrink-0" />

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search students by name, ID or course…"
              className="min-w-0 w-full bg-transparent text-sm outline-none"
            />
          </div>

          {/* Add student */}
          <PrimaryButton
            onClick={() => setModal("new")}
            className="w-full justify-center sm:w-auto"
          >
            <Plus size={15} />
            Add Student
          </PrimaryButton>
        </div>

        {/* Mobile student cards */}
        <div className="block sm:hidden">
          {loading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-xl border p-4"
                  style={{ borderColor: AT.line }}
                >
                  <div className="h-4 w-2/3 rounded bg-slate-200" />
                  <div className="mt-2 h-3 w-4/5 rounded bg-slate-200" />
                  <div className="mt-4 h-3 w-1/2 rounded bg-slate-200" />
                </div>
              ))}
            </div>
          ) : filtered.length > 0 ? (
            <div className="divide-y" style={{ borderColor: AT.line }}>
              {filtered.map((student) => (
                <MobileStudentCard
                  key={student.id}
                  student={student}
                  onView={() => setViewing(student)}
                  onToggle={() => toggleStatus(student)}
                  onEdit={() => setModal(student)}
                  onDelete={() => setConfirmDelete(student)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              text={
                query
                  ? "No students match your search."
                  : "No students yet — add your first one."
              }
            />
          )}
        </div>

        {/* Desktop / tablet table */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="text-left" style={{ color: AT.sub }}>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Course</th>
                <th className="px-4 py-3 font-medium">Fees</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRowSkeleton key={i} columns={5} />
                ))
              ) : filtered.length > 0 ? (
                filtered.map((student) => (
                  <DesktopStudentRow
                    key={student.id}
                    student={student}
                    onView={() => setViewing(student)}
                    onToggle={() => toggleStatus(student)}
                    onEdit={() => setModal(student)}
                    onDelete={() => setConfirmDelete(student)}
                  />
                ))
              ) : null}
            </tbody>
          </table>

          {!loading && filtered.length === 0 && (
            <EmptyState
              text={
                query
                  ? "No students match your search."
                  : "No students yet — add your first one."
              }
            />
          )}
        </div>

        {/* Edit / Add */}
        {modal && (
          <StudentForm
            initial={modal === "new" ? null : modal}
            saving={saving}
            onCancel={() => setModal(null)}
            onSave={save}
          />
        )}

        {/* Details */}
        {viewing && (
          <StudentDetail
            student={viewing}
            payments={payments.filter(
              (p) =>
                p.studentId === viewing.id ||
                p.studentName === viewing.name
            )}
            onClose={() => setViewing(null)}
            onEdit={() => {
              setModal(viewing);
              setViewing(null);
            }}
            onDelete={() => {
              setConfirmDelete(viewing);
            }}
          />
        )}

        {/* Delete */}
        {confirmDelete && (
          <ConfirmDeleteModal
            name={confirmDelete.name}
            onCancel={() => setConfirmDelete(null)}
            onConfirm={() => remove(confirmDelete)}
          />
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Desktop student row                                                */
/* ------------------------------------------------------------------ */

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
      style={{ borderColor: AT.line }}
      onClick={onView}
    >
      <td className="max-w-[320px] px-4 py-3">
        <p
          className="truncate font-medium"
          style={{ color: AT.ink }}
        >
          {student.name || "Unnamed student"}
        </p>

        <p
          className="mt-0.5 truncate text-xs"
          style={{ color: AT.sub }}
        >
          {student.email || "No email"} · {student.id}
        </p>
      </td>

      <td
        className="max-w-[220px] px-4 py-3"
        style={{ color: AT.ink }}
      >
        <span className="block truncate">
          {student.course || "—"}
        </span>

        <span
          className="block text-xs"
          style={{ color: AT.sub }}
        >
          {student.year || "—"}
        </span>
      </td>

      <td className="px-4 py-3">
        <Pill tone={student.fees} />
      </td>

      <td className="px-4 py-3">
        <Pill tone={student.status} />
      </td>

      <td className="px-4 py-3">
        <div
          className="flex justify-end gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <ActionButton
            title="View details"
            onClick={onView}
            color={AT.sub}
          >
            <Eye size={16} />
          </ActionButton>

          <ActionButton
            title="Toggle active/blocked"
            onClick={onToggle}
            color={AT.sub}
          >
            {student.status === "active" ? (
              <UserX size={16} />
            ) : (
              <UserCheck size={16} />
            )}
          </ActionButton>

          <ActionButton
            title="Edit"
            onClick={onEdit}
            color={AT.sub}
          >
            <Pencil size={16} />
          </ActionButton>

          <ActionButton
            title="Delete"
            onClick={onDelete}
            color={AT.danger}
          >
            <Trash2 size={16} />
          </ActionButton>
        </div>
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile student card                                                */
/* ------------------------------------------------------------------ */

function MobileStudentCard({
  student,
  onView,
  onToggle,
  onEdit,
  onDelete,
}) {
  return (
    <div
      className="p-3"
      onClick={onView}
    >
      <div
        className="rounded-xl border p-3.5"
        style={{ borderColor: AT.line }}
      >
        {/* Header */}
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
            style={{
              background: AT.accentSoft,
              color: AT.accentDeep,
            }}
          >
            {(student.name || "S")
              .trim()
              .charAt(0)
              .toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <p
              className="break-words text-sm font-semibold"
              style={{ color: AT.ink }}
            >
              {student.name || "Unnamed student"}
            </p>

            <p
              className="mt-0.5 break-all text-xs"
              style={{ color: AT.sub }}
            >
              {student.email || "No email"}
            </p>
          </div>

          <Pill tone={student.status} />
        </div>

        {/* Course info */}
        <div
          className="mt-3 grid grid-cols-2 gap-3 rounded-lg p-3"
          style={{ background: AT.canvas }}
        >
          <div className="min-w-0">
            <p
              className="text-[11px]"
              style={{ color: AT.sub }}
            >
              Course
            </p>

            <p
              className="mt-0.5 truncate text-xs font-medium"
              style={{ color: AT.ink }}
            >
              {student.course || "—"}
            </p>
          </div>

          <div className="min-w-0">
            <p
              className="text-[11px]"
              style={{ color: AT.sub }}
            >
              Year
            </p>

            <p
              className="mt-0.5 text-xs font-medium"
              style={{ color: AT.ink }}
            >
              {student.year || "—"}
            </p>
          </div>

          <div>
            <p
              className="text-[11px]"
              style={{ color: AT.sub }}
            >
              Fees
            </p>

            <div className="mt-1">
              <Pill tone={student.fees} />
            </div>
          </div>

          <div className="min-w-0">
            <p
              className="text-[11px]"
              style={{ color: AT.sub }}
            >
              Student ID
            </p>

            <p
              className="mt-0.5 break-all text-[11px]"
              style={{ color: AT.ink }}
            >
              {student.id}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div
          className="mt-3 grid grid-cols-4 gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <MobileActionButton
            label="View"
            onClick={onView}
            color={AT.sub}
          >
            <Eye size={15} />
          </MobileActionButton>

          <MobileActionButton
            label={student.status === "active" ? "Block" : "Activate"}
            onClick={onToggle}
            color={AT.sub}
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
            color={AT.sub}
          >
            <Pencil size={15} />
          </MobileActionButton>

          <MobileActionButton
            label="Delete"
            onClick={onDelete}
            color={AT.danger}
          >
            <Trash2 size={15} />
          </MobileActionButton>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Action buttons                                                      */
/* ------------------------------------------------------------------ */

function ActionButton({ children, onClick, title, color }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-black/5"
      style={{ color }}
    >
      {children}
    </button>
  );
}

function MobileActionButton({
  children,
  label,
  onClick,
  color,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[42px] min-w-0 flex-col items-center justify-center gap-1 rounded-lg border text-[10px] font-medium"
      style={{
        borderColor: AT.line,
        color,
      }}
    >
      {children}
      <span className="truncate">{label}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Student form                                                        */
/* ------------------------------------------------------------------ */

function StudentForm({
  initial,
  saving,
  onCancel,
  onSave,
}) {
  const [form, setForm] = useState(
    initial || {
      name: "",
      email: "",
      course: "",
      year: "1st Yr",
    }
  );

  return (
    <Modal
      title={initial ? "Edit student" : "Add student"}
      onClose={onCancel}
    >
      <div className="space-y-1">
        <Field
          label="Full name"
          value={form.name}
          onChange={(e) =>
            setForm({
              ...form,
              name: e.target.value,
            })
          }
        />

        <Field
          label="Email"
          value={form.email}
          onChange={(e) =>
            setForm({
              ...form,
              email: e.target.value,
            })
          }
        />

        <Field
          label="Course"
          value={form.course}
          onChange={(e) =>
            setForm({
              ...form,
              course: e.target.value,
            })
          }
        />

        <Field
          label="Year"
          value={form.year}
          onChange={(e) =>
            setForm({
              ...form,
              year: e.target.value,
            })
          }
        />
      </div>

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <GhostButton
          onClick={onCancel}
          className="w-full justify-center sm:w-auto"
        >
          Cancel
        </GhostButton>

        <PrimaryButton
          disabled={saving || !form.name.trim()}
          onClick={() =>
            form.name.trim() && onSave(form)
          }
          className="w-full justify-center sm:w-auto"
        >
          {saving ? "Saving…" : "Save"}
        </PrimaryButton>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Student detail                                                      */
/* ------------------------------------------------------------------ */

function StudentDetail({
  student,
  payments,
  onClose,
  onEdit,
  onDelete,
}) {
  const enrolled = toDate(student.createdAt);

  const totalPaid = payments
    .filter(
      (p) =>
        !p.status ||
        p.status === "success" ||
        p.status === "paid"
    )
    .reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
      0
    );

  return (
    <Modal
      title="Student details"
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* Profile */}
        <div
          className="rounded-xl border p-3.5 sm:p-4"
          style={{ borderColor: AT.line }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-semibold"
              style={{
                background: AT.accentSoft,
                color: AT.accentDeep,
              }}
            >
              {(student.name || "S")
                .trim()
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="min-w-0">
              <p
                className="break-words text-base font-semibold"
                style={{ color: AT.ink }}
              >
                {student.name || "Unnamed student"}
              </p>

              <p
                className="break-all text-sm"
                style={{ color: AT.sub }}
              >
                {student.email || "No email"}
              </p>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <DetailRow
            label="Student ID"
            value={student.id}
          />

          <DetailRow
            label="Course"
            value={student.course || "—"}
          />

          <DetailRow
            label="Year"
            value={student.year || "—"}
          />

          <DetailRow
            label="Enrolled"
            value={
              enrolled
                ? enrolled.toLocaleDateString()
                : "—"
            }
          />

          <DetailRow
            label="Status"
            node={<Pill tone={student.status} />}
          />

          <DetailRow
            label="Fees"
            node={<Pill tone={student.fees} />}
          />
        </div>

        {/* Payments */}
        <div>
          <div className="mb-2 flex flex-col gap-1 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
            <p
              className="text-sm font-medium"
              style={{ color: AT.ink }}
            >
              Payment history
            </p>

            <p
              className="text-xs"
              style={{ color: AT.sub }}
            >
              Total paid: ₹
              {totalPaid.toLocaleString()}
            </p>
          </div>

          {payments.length === 0 ? (
            <div
              className="rounded-lg border p-3 text-sm"
              style={{
                borderColor: AT.line,
                color: AT.sub,
              }}
            >
              No payments on record.
            </div>
          ) : (
            <div
              className="divide-y overflow-hidden rounded-lg border"
              style={{ borderColor: AT.line }}
            >
              {payments
                .slice()
                .sort(
                  (a, b) =>
                    (toDate(b.createdAt) || 0) -
                    (toDate(a.createdAt) || 0)
                )
                .map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col gap-1 px-3 py-2.5 text-sm min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between"
                  >
                    <span
                      className="break-words"
                      style={{ color: AT.ink }}
                    >
                      ₹{p.amount}

                      <span style={{ color: AT.sub }}>
                        {" "}
                        · {p.status || "recorded"}
                      </span>
                    </span>

                    <span
                      className="text-xs"
                      style={{ color: AT.sub }}
                    >
                      {toDate(
                        p.createdAt
                      )?.toLocaleDateString() || ""}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div
          className="flex flex-col-reverse gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: AT.line }}
        >
          <button
            type="button"
            onClick={onDelete}
            className="w-full text-left text-sm sm:w-auto"
            style={{ color: AT.danger }}
          >
            Remove student
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

/* ------------------------------------------------------------------ */
/* Detail row                                                          */
/* ------------------------------------------------------------------ */

function DetailRow({ label, value, node }) {
  return (
    <div
      className="min-w-0 rounded-lg p-3"
      style={{ background: AT.canvas }}
    >
      <p
        className="text-[11px]"
        style={{ color: AT.sub }}
      >
        {label}
      </p>

      {node ?? (
        <p
          className="mt-0.5 break-words text-sm"
          style={{ color: AT.ink }}
        >
          {value}
        </p>
      )}
    </div>
  );
}