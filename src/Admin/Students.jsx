import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Pencil, Trash2, UserCheck, UserX, Eye } from "lucide-react";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/Firebase";
import {
  AT, Pill, Card, Modal, Field, PrimaryButton, GhostButton, EmptyState, ConfirmDeleteModal,
} from "./AdminUI";
import { TableRowSkeleton } from "../components/Skeleton";

// Firestore collection names — change if yours differ
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
        setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
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
      (snap) => setPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => setError(err.message)
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return students.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.id?.toLowerCase().includes(q) ||
        s.course?.toLowerCase().includes(q)
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
    <Card title={null} action={null}>
      {error && (
        <div className="px-4 py-2 text-sm" style={{ background: "#fdecea", color: "#b3261e" }}>
          {error}. Check the collection names at the top of this file and your Firestore
          security rules.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 p-4 border-b" style={{ borderColor: AT.line }}>
        <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 flex-1 min-w-[180px]" style={{ borderColor: AT.line }}>
          <Search size={15} color={AT.sub} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search students by name, ID or course…"
            className="text-sm outline-none w-full"
          />
        </div>
        <PrimaryButton onClick={() => setModal("new")}>
          <Plus size={15} /> Add Student
        </PrimaryButton>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: AT.sub }}>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Course</th>
              <th className="px-4 py-3 font-medium">Fees</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} columns={5} />)
            ) : (
              filtered.map((s) => (
                <tr
                  key={s.id}
                  className="border-t cursor-pointer hover:bg-black/[0.02]"
                  style={{ borderColor: AT.line }}
                  onClick={() => setViewing(s)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium" style={{ color: AT.ink }}>{s.name}</p>
                    <p className="text-xs" style={{ color: AT.sub }}>{s.email} · {s.id}</p>
                  </td>
                  <td className="px-4 py-3" style={{ color: AT.ink }}>
                    {s.course}
                    <span className="block text-xs" style={{ color: AT.sub }}>{s.year}</span>
                  </td>
                  <td className="px-4 py-3"><Pill tone={s.fees} /></td>
                  <td className="px-4 py-3"><Pill tone={s.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3" onClick={(e) => e.stopPropagation()}>
                      <button title="View details" onClick={() => setViewing(s)} style={{ color: AT.sub }}>
                        <Eye size={16} />
                      </button>
                      <button title="Toggle active/blocked" onClick={() => toggleStatus(s)} style={{ color: AT.sub }}>
                        {s.status === "active" ? <UserX size={16} /> : <UserCheck size={16} />}
                      </button>
                      <button title="Edit" onClick={() => setModal(s)} style={{ color: AT.sub }}>
                        <Pencil size={16} />
                      </button>
                      <button title="Delete" onClick={() => setConfirmDelete(s)} style={{ color: AT.danger }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <EmptyState text={query ? "No students match your search." : "No students yet — add your first one."} />
        )}
      </div>

      {modal && (
        <StudentForm
          initial={modal === "new" ? null : modal}
          saving={saving}
          onCancel={() => setModal(null)}
          onSave={save}
        />
      )}

      {viewing && (
        <StudentDetail
          student={viewing}
          payments={payments.filter(
            (p) => p.studentId === viewing.id || p.studentName === viewing.name
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

      {confirmDelete && (
        <ConfirmDeleteModal
          name={confirmDelete.name}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => remove(confirmDelete)}
        />
      )}
    </Card>
  );
}

function StudentForm({ initial, saving, onCancel, onSave }) {
  const [form, setForm] = useState(initial || { name: "", email: "", course: "", year: "1st Yr" });
  return (
    <Modal title={initial ? "Edit student" : "Add student"} onClose={onCancel}>
      <Field label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <Field label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <Field label="Course" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} />
      <Field label="Year" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
      <div className="flex justify-end gap-2 mt-2">
        <GhostButton onClick={onCancel}>Cancel</GhostButton>
        <PrimaryButton disabled={saving} onClick={() => form.name.trim() && onSave(form)}>
          {saving ? "Saving…" : "Save"}
        </PrimaryButton>
      </div>
    </Modal>
  );
}

function StudentDetail({ student, payments, onClose, onEdit, onDelete }) {
  const enrolled = toDate(student.createdAt);
  const totalPaid = payments
    .filter((p) => !p.status || p.status === "success" || p.status === "paid")
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  return (
    <Modal title="Student details" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="text-base font-semibold" style={{ color: AT.ink }}>{student.name}</p>
          <p className="text-sm" style={{ color: AT.sub }}>{student.email}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <DetailRow label="Student ID" value={student.id} />
          <DetailRow label="Course" value={student.course || "—"} />
          <DetailRow label="Year" value={student.year || "—"} />
          <DetailRow label="Enrolled" value={enrolled ? enrolled.toLocaleDateString() : "—"} />
          <DetailRow label="Status" node={<Pill tone={student.status} />} />
          <DetailRow label="Fees" node={<Pill tone={student.fees} />} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium" style={{ color: AT.ink }}>Payment history</p>
            <p className="text-xs" style={{ color: AT.sub }}>Total paid: ₹{totalPaid.toLocaleString()}</p>
          </div>
          {payments.length === 0 ? (
            <p className="text-sm" style={{ color: AT.sub }}>No payments on record.</p>
          ) : (
            <div className="divide-y rounded-lg border" style={{ borderColor: AT.line }}>
              {payments
                .slice()
                .sort((a, b) => (toDate(b.createdAt) || 0) - (toDate(a.createdAt) || 0))
                .map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span style={{ color: AT.ink }}>
                      ₹{p.amount} <span style={{ color: AT.sub }}>· {p.status || "recorded"}</span>
                    </span>
                    <span style={{ color: AT.sub }}>
                      {toDate(p.createdAt)?.toLocaleDateString() || ""}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 pt-2">
          <button onClick={onDelete} className="text-sm" style={{ color: AT.danger }}>
            Remove student
          </button>
          <div className="flex gap-2">
            <GhostButton onClick={onClose}>Close</GhostButton>
            <PrimaryButton onClick={onEdit}>Edit</PrimaryButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function DetailRow({ label, value, node }) {
  return (
    <div>
      <p className="text-xs" style={{ color: AT.sub }}>{label}</p>
      {node ?? <p style={{ color: AT.ink }}>{value}</p>}
    </div>
  );
}