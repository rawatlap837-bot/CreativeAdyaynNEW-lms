import { useState, useEffect, useRef } from "react";
import {
  Search,
  ShieldCheck,
  UserCheck,
  GraduationCap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
} from "../lib/database";

import { auth, db } from "../lib/backend";

import {
  AT,
  Card,
  Modal,
  PrimaryButton,
  GhostButton,
  EmptyState,
} from "./AdminUI.jsx";

/**
 * Promote, demote, or reassign a user's role by email — one at a
 * time or in bulk — and review/edit everyone whose role has been
 * changed.
 *
 * Requires the user to have signed up at least once so that
 * users/{uid} exists with an email field.
 *
 * The role change itself is only ever a convenience here — the
 * actual security boundary is Supabase RLS policies, which is the only
 * thing that can't be bypassed from the browser console. This page
 * just gives admins a safer, clearer way to drive that boundary:
 * pick a role explicitly, confirm the change, and can't demote
 * their own account by accident.
 */

const ROLES = [
  {
    id: "student",
    label: "Student",
    icon: UserCheck,
    tone: AT.chrome,
  },
  {
    id: "teacher",
    label: "Teacher",
    icon: GraduationCap,
    tone: AT.accentDeep,
  },
  {
    id: "admin",
    label: "Admin",
    icon: ShieldCheck,
    tone: AT.danger,
  },
];

const roleMeta = (id) =>
  ROLES.find((r) => r.id === id) || ROLES[0];

// Splits a blob of pasted text into a deduped list of lowercase
// emails, however it was separated (commas, spaces, new lines...).
const parseEmailList = (text) =>
  Array.from(
    new Set(
      text
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s && s.includes("@"))
    )
  );

export default function Admins() {
  const topRef = useRef(null);

  const [email, setEmail] = useState("");

  const [status, setStatus] = useState("idle");
  // idle | searching | found | notfound | error

  const [found, setFound] = useState(null);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  // The role a confirmation dialog is currently pending for, or null.
  const [pendingRole, setPendingRole] = useState(null);

  // Bulk assignment
  const [bulkEmails, setBulkEmails] = useState("");
  const [bulkRole, setBulkRole] = useState("student");
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkResults, setBulkResults] = useState([]);
  // [{ email, status: "pending" | "updated" | "notfound" | "error", message? }]

  // Users whose role has been assigned/changed, for review + editing
  const [assigned, setAssigned] = useState([]);
  const [assignedLoading, setAssignedLoading] = useState(true);
  const [assignedError, setAssignedError] = useState("");

  const bulkEmailList = parseEmailList(bulkEmails);

  /* ============================================================
     SEARCH USER
  ============================================================ */

  const search = async (e) => {
    e.preventDefault();

    const trimmed = email.trim().toLowerCase();

    if (!trimmed) return;

    setStatus("searching");
    setError("");
    setFound(null);
    setPendingRole(null);

    try {
      const q = query(
        collection(db, "users"),
        where("email", "==", trimmed)
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        setStatus("notfound");
      } else {
        const d = snap.docs[0];

        setFound({
          id: d.id,
          ...d.data(),
        });

        setStatus("found");
      }
    } catch (err) {
      console.error(err);

      setError(
        err?.message || "Search failed."
      );

      setStatus("error");
    }
  };

  /* ============================================================
     CHANGE ROLE (single user)
  ============================================================ */

  // Step 1: clicking a role pill. Guards against the one mistake the
  // UI itself can actually prevent — an admin locking themselves out
  // by demoting their own account — then opens a confirm dialog
  // instead of writing immediately.
  const requestRoleChange = (newRole) => {
    if (!found || newRole === (found.role || "student")) return;

    if (
      found.id === auth.currentUser?.uid &&
      newRole !== "admin"
    ) {
      setError(
        "You can't change your own role away from admin — have another admin do it instead."
      );
      return;
    }

    setError("");
    setPendingRole(newRole);
  };

  // Step 2: confirmed in the modal. This is the only place that
  // actually writes — Supabase RLS policies is what makes this safe to
  // trust, not this function.
  const setRole = async (newRole) => {
    if (!found) return;

    setUpdating(true);
    setError("");

    try {
      await updateDoc(
        doc(db, "users", found.id),
        {
          role: newRole,
          roleChangedAt: serverTimestamp(),
          roleChangedBy: auth.currentUser?.uid || null,
        }
      );

      setFound({
        ...found,
        role: newRole,
      });

      setPendingRole(null);

      // Keep the "recently assigned" list in sync with this change.
      fetchAssigned();
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
        "Couldn't update role."
      );
    } finally {
      setUpdating(false);
    }
  };

  /* ============================================================
     BULK ASSIGN ROLES
  ============================================================ */

  const runBulkAssign = async (e) => {
    e.preventDefault();

    const emails = parseEmailList(bulkEmails);

    if (emails.length === 0 || bulkRunning) return;

    setBulkRunning(true);
    setBulkResults(
      emails.map((email) => ({ email, status: "pending" }))
    );

    const results = [];

    // Sequential on purpose: keeps writes gentle on Supabase database and
    // lets the list above update one row at a time so admins can
    // watch a big batch progress instead of staring at a spinner.
    for (const email of emails) {
      try {
        const q = query(
          collection(db, "users"),
          where("email", "==", email)
        );

        const snap = await getDocs(q);

        if (snap.empty) {
          results.push({ email, status: "notfound" });
        } else {
          const d = snap.docs[0];

          if (
            d.id === auth.currentUser?.uid &&
            bulkRole !== "admin"
          ) {
            results.push({
              email,
              status: "error",
              message: "Can't change your own role this way.",
            });
          } else {
            await updateDoc(doc(db, "users", d.id), {
              role: bulkRole,
              roleChangedAt: serverTimestamp(),
              roleChangedBy: auth.currentUser?.uid || null,
            });

            results.push({ email, status: "updated" });
          }
        }
      } catch (err) {
        console.error(err);

        results.push({
          email,
          status: "error",
          message: err?.message || "Update failed.",
        });
      }

      // Progressive render: processed rows show their real status,
      // the rest still show "pending".
      setBulkResults([
        ...results,
        ...emails.slice(results.length).map((email) => ({
          email,
          status: "pending",
        })),
      ]);
    }

    setBulkRunning(false);
    fetchAssigned();
  };

  /* ============================================================
     ASSIGNED ROLES LIST
  ============================================================ */

  const fetchAssigned = async () => {
    setAssignedLoading(true);
    setAssignedError("");

    try {
      const q = query(
        collection(db, "users"),
        orderBy("roleChangedAt", "desc"),
        limit(50)
      );

      const snap = await getDocs(q);

      setAssigned(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    } catch (err) {
      console.error(err);

      setAssignedError(
        err?.message || "Couldn't load assigned roles."
      );
    } finally {
      setAssignedLoading(false);
    }
  };

  useEffect(() => {
    fetchAssigned();
  }, []);

  // Jump from the list straight into the existing single-user
  // editor above, instead of duplicating the role-picker + confirm
  // modal logic a second time.
  const editFromList = (u) => {
    setFound(u);
    setStatus("found");
    setEmail(u.email || "");
    setError("");
    setPendingRole(null);

    topRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  /* ============================================================
     UI
  ============================================================ */

  return (
    <div
      ref={topRef}
      className="w-full min-w-0 space-y-4 overflow-x-hidden"
    >

      <Card title="Promote or demote by email">

        <div className="p-4 sm:p-5">

          {/* ======================================================
              SEARCH FORM
          ====================================================== */}

          <form
            onSubmit={search}
            className="
              flex
              w-full
              flex-col
              gap-3
              sm:flex-row
            "
          >

            {/* Email Input */}

            <div className="relative min-w-0 flex-1">

              <Search
                size={16}
                className="
                  absolute
                  left-3
                  top-1/2
                  -translate-y-1/2
                "
                color={AT.sub}
              />

              <input
                type="email"
                required
                placeholder="student@example.com"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                className="
                  w-full
                  rounded-xl
                  border
                  py-2.5
                  pl-9
                  pr-3
                  text-sm
                  outline-none
                  transition
                  focus:ring-2
                  focus:ring-violet-100
                "
                style={{
                  borderColor: AT.line,
                }}
              />

            </div>

            {/* Search Button */}

            <PrimaryButton
              type="submit"
              disabled={
                status === "searching"
              }
              className="
                w-full
                shrink-0
                sm:w-auto
              "
            >
              {status === "searching"
                ? "Searching…"
                : "Search"}
            </PrimaryButton>

          </form>

          {/* ======================================================
              NOT FOUND
          ====================================================== */}

          {status === "notfound" && (
            <div
              className="
                mt-4
                rounded-xl
                border
                border-slate-200
                bg-slate-50
                px-4
                py-3
                text-xs
                leading-5
                sm:text-sm
              "
              style={{
                color: AT.sub,
              }}
            >
              No account found for that email.

              <br className="sm:hidden" />

              <span className="sm:ml-1">
                They need to sign up first. Accounts
                created before this feature was added
                may also need to log in once to create
                their profile automatically.
              </span>
            </div>
          )}

          {/* ======================================================
              SEARCH ERROR
          ====================================================== */}

          {status === "error" && (
            <div
              className="
                mt-4
                rounded-xl
                px-4
                py-3
                text-xs
                leading-5
                sm:text-sm
              "
              style={{
                background:
                  AT.dangerSoft,
                color: AT.danger,
              }}
            >
              {error}
            </div>
          )}

          {/* ======================================================
              FOUND USER
          ====================================================== */}

          {found && (
            <div
              className="
                mt-4
                flex
                flex-col
                gap-4
                rounded-xl
                border
                p-4
                sm:flex-row
                sm:items-center
                sm:justify-between
                sm:p-5
              "
              style={{
                borderColor: AT.line,
              }}
            >

              {/* --------------------------------------------------
                  USER INFO
              -------------------------------------------------- */}

              <div
                className="
                  flex
                  min-w-0
                  items-start
                  gap-3
                "
              >

                {/* Avatar */}

                <div
                  className="
                    flex
                    h-10
                    w-10
                    shrink-0
                    items-center
                    justify-center
                    rounded-full
                  "
                  style={{
                    background:
                      AT.accentSoft,
                  }}
                >
                  <UserCheck
                    size={17}
                    color={AT.accentDeep}
                  />
                </div>

                {/* Details */}

                <div className="min-w-0">

                  <p
                    className="
                      break-words
                      text-sm
                      font-semibold
                    "
                    style={{
                      color: AT.ink,
                    }}
                  >
                    {found.name ||
                      "(no name on file)"}
                  </p>

                  <p
                    className="
                      mt-1
                      break-all
                      text-xs
                      leading-5
                    "
                    style={{
                      color: AT.sub,
                    }}
                  >
                    {found.email}
                  </p>

                  <p
                    className="
                      mt-0.5
                      text-xs
                    "
                    style={{
                      color: AT.sub,
                    }}
                  >
                    Currently{" "}
                    <span className="font-semibold capitalize">
                      {found.role ||
                        "student"}
                    </span>
                  </p>

                </div>

              </div>

              {/* --------------------------------------------------
                  ROLE PICKER
                  Three explicit roles instead of one toggle, so
                  promoting to teacher doesn't require routing
                  through admin first. Clicking a role that isn't
                  the current one opens the confirm modal below —
                  nothing here writes to Supabase database directly.
              -------------------------------------------------- */}

              <div
                className="
                  flex
                  w-full
                  shrink-0
                  gap-2
                  sm:w-auto
                "
              >
                {ROLES.map((r) => {
                  const isCurrent =
                    (found.role || "student") === r.id;
                  const Icon = r.icon;

                  return (
                    <button
                      key={r.id}
                      type="button"
                      disabled={updating || isCurrent}
                      onClick={() =>
                        requestRoleChange(r.id)
                      }
                      title={
                        isCurrent
                          ? `Already ${r.label}`
                          : `Set role to ${r.label}`
                      }
                      className="
                        flex
                        flex-1
                        items-center
                        justify-center
                        gap-1.5
                        rounded-xl
                        border
                        px-3
                        py-2.5
                        text-xs
                        font-semibold
                        transition
                        disabled:cursor-not-allowed
                        sm:flex-none
                        sm:text-sm
                      "
                      style={
                        isCurrent
                          ? {
                            background: r.tone,
                            borderColor: r.tone,
                            color: "#fff",
                            opacity: 0.55,
                          }
                          : {
                            background: AT.card,
                            borderColor: AT.line,
                            color: AT.ink,
                          }
                      }
                    >
                      <Icon size={15} />
                      {r.label}
                    </button>
                  );
                })}
              </div>

            </div>
          )}

          {/* ======================================================
              CONFIRM ROLE CHANGE
          ====================================================== */}

          {pendingRole && found && (
            <Modal
              title="Confirm role change"
              onClose={() =>
                !updating && setPendingRole(null)
              }
            >
              <div className="p-4 sm:p-5">
                <div
                  className="
                    mb-4
                    flex
                    items-start
                    gap-3
                    rounded-xl
                    px-3
                    py-2.5
                    text-sm
                  "
                  style={{
                    background:
                      pendingRole === "admin"
                        ? AT.dangerSoft
                        : AT.warnSoft,
                    color:
                      pendingRole === "admin"
                        ? AT.danger
                        : AT.warn,
                  }}
                >
                  <AlertTriangle
                    size={16}
                    className="mt-0.5 shrink-0"
                  />

                  <span>
                    {pendingRole === "admin"
                      ? "Admin has full access to every student, course, and payment record."
                      : "This will take away their current access immediately."}
                  </span>
                </div>

                <p
                  className="mb-5 text-sm leading-6"
                  style={{ color: AT.ink }}
                >
                  Change{" "}
                  <span className="font-semibold">
                    {found.name || found.email}
                  </span>
                  's role from{" "}
                  <span className="font-semibold capitalize">
                    {found.role || "student"}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold capitalize">
                    {pendingRole}
                  </span>
                  ?
                </p>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <GhostButton
                    onClick={() => setPendingRole(null)}
                    disabled={updating}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </GhostButton>

                  <PrimaryButton
                    onClick={() => setRole(pendingRole)}
                    disabled={updating}
                    className="w-full sm:w-auto"
                  >
                    {updating
                      ? "Updating…"
                      : `Yes, make ${pendingRole}`}
                  </PrimaryButton>
                </div>
              </div>
            </Modal>
          )}

          {/* ======================================================
              GENERAL ERROR
          ====================================================== */}

          {error && status !== "error" && (
            <div
              className="
                mt-4
                rounded-xl
                px-4
                py-3
                text-xs
                leading-5
                sm:text-sm
              "
              style={{
                background:
                  AT.dangerSoft,
                color: AT.danger,
              }}
            >
              {error}
            </div>
          )}

          {/* ======================================================
              EMPTY STATE
          ====================================================== */}

          {status === "idle" && !found && (
            <div className="mt-2">
              <EmptyState text="Search a signed-up user's email to change their role." />
            </div>
          )}

        </div>

      </Card>

      {/* ==========================================================
          BULK ASSIGN ROLES
          Paste many emails at once and push the same role to all
          of them. Same guardrails and same Supabase database write as the
          single-user flow above — just looped, with each row's
          outcome shown as it lands.
      ========================================================== */}

      <Card title="Bulk assign roles">

        <div className="p-4 sm:p-5">

          <p
            className="mb-3 text-xs leading-5 sm:text-sm"
            style={{ color: AT.sub }}
          >
            Paste a batch of emails — separated by commas, spaces,
            or new lines — to assign the same role to all of them
            at once. Everyone still needs to have signed up first.
          </p>

          <form onSubmit={runBulkAssign} className="space-y-3">

            <textarea
              rows={4}
              placeholder={
                "jane@example.com\njohn@example.com, sam@example.com"
              }
              value={bulkEmails}
              onChange={(e) =>
                setBulkEmails(e.target.value)
              }
              disabled={bulkRunning}
              className="
                w-full
                resize-y
                rounded-xl
                border
                px-3
                py-2.5
                text-sm
                outline-none
                transition
                focus:ring-2
                focus:ring-violet-100
                disabled:opacity-60
              "
              style={{
                borderColor: AT.line,
              }}
            />

            <div
              className="
                flex
                flex-col
                gap-3
                sm:flex-row
                sm:items-center
                sm:justify-between
              "
            >

              {/* Role picker for the whole batch */}

              <div className="flex w-full gap-2 sm:w-auto">
                {ROLES.map((r) => {
                  const Icon = r.icon;
                  const active = bulkRole === r.id;

                  return (
                    <button
                      key={r.id}
                      type="button"
                      disabled={bulkRunning}
                      onClick={() =>
                        setBulkRole(r.id)
                      }
                      className="
                        flex
                        flex-1
                        items-center
                        justify-center
                        gap-1.5
                        rounded-xl
                        border
                        px-3
                        py-2
                        text-xs
                        font-semibold
                        transition
                        disabled:cursor-not-allowed
                        sm:flex-none
                        sm:text-sm
                      "
                      style={
                        active
                          ? {
                            background: r.tone,
                            borderColor: r.tone,
                            color: "#fff",
                          }
                          : {
                            background: AT.card,
                            borderColor: AT.line,
                            color: AT.ink,
                          }
                      }
                    >
                      <Icon size={14} />
                      {r.label}
                    </button>
                  );
                })}
              </div>

              <PrimaryButton
                type="submit"
                disabled={
                  bulkRunning ||
                  bulkEmailList.length === 0
                }
                className="w-full sm:w-auto"
              >
                {bulkRunning
                  ? "Assigning…"
                  : bulkEmailList.length === 0
                    ? "Assign role"
                    : `Assign ${bulkEmailList.length} as ${roleMeta(bulkRole).label
                    }`}
              </PrimaryButton>

            </div>

          </form>

          {/* Per-email results */}

          {bulkResults.length > 0 && (
            <div
              className="mt-4 divide-y overflow-hidden rounded-xl border"
              style={{ borderColor: AT.line }}
            >
              {bulkResults.map((r) => (
                <div
                  key={r.email}
                  className="
                    flex
                    items-center
                    justify-between
                    gap-3
                    px-3
                    py-2
                    text-xs
                    sm:text-sm
                  "
                  style={{
                    borderColor: AT.line,
                  }}
                >
                  <span
                    className="min-w-0 truncate"
                    style={{ color: AT.ink }}
                  >
                    {r.email}
                  </span>

                  {r.status === "pending" && (
                    <span style={{ color: AT.sub }}>
                      Waiting…
                    </span>
                  )}

                  {r.status === "updated" && (
                    <span
                      className="flex shrink-0 items-center gap-1 font-semibold"
                      style={{ color: AT.accentDeep }}
                    >
                      <CheckCircle2 size={14} />
                      Updated
                    </span>
                  )}

                  {r.status === "notfound" && (
                    <span
                      className="flex shrink-0 items-center gap-1"
                      style={{ color: AT.sub }}
                    >
                      <XCircle size={14} />
                      No account
                    </span>
                  )}

                  {r.status === "error" && (
                    <span
                      className="flex shrink-0 items-center gap-1 font-semibold"
                      style={{ color: AT.danger }}
                      title={r.message}
                    >
                      <AlertTriangle size={14} />
                      {r.message || "Failed"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>

      </Card>

      {/* ==========================================================
          RECENTLY ASSIGNED ROLES
          Anyone whose role was changed — one at a time or in bulk
          — shows up here, newest first, so it doubles as an audit
          trail and a quick way back into the editor above.
      ========================================================== */}

      <Card title="Recently assigned roles">

        <div className="p-4 sm:p-5">

          {assignedLoading && (
            <p
              className="text-xs sm:text-sm"
              style={{ color: AT.sub }}
            >
              Loading…
            </p>
          )}

          {!assignedLoading && assignedError && (
            <div
              className="
                rounded-xl
                px-4
                py-3
                text-xs
                leading-5
                sm:text-sm
              "
              style={{
                background: AT.dangerSoft,
                color: AT.danger,
              }}
            >
              {assignedError}
            </div>
          )}

          {!assignedLoading &&
            !assignedError &&
            assigned.length === 0 && (
              <EmptyState text="No role changes yet. Roles you assign, one at a time or in bulk, will show up here." />
            )}

          {!assignedLoading &&
            !assignedError &&
            assigned.length > 0 && (
              <div className="space-y-2">
                {assigned.map((u) => {
                  const role = roleMeta(u.role || "student");
                  const Icon = role.icon;

                  return (
                    <div
                      key={u.id}
                      className="
                        flex
                        flex-col
                        gap-3
                        rounded-xl
                        border
                        p-3
                        sm:flex-row
                        sm:items-center
                        sm:justify-between
                      "
                      style={{
                        borderColor: AT.line,
                      }}
                    >

                      <div className="min-w-0">
                        <p
                          className="truncate text-sm font-semibold"
                          style={{ color: AT.ink }}
                        >
                          {u.name || "(no name on file)"}
                        </p>
                        <p
                          className="truncate text-xs"
                          style={{ color: AT.sub }}
                        >
                          {u.email}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className="
                            flex
                            items-center
                            gap-1
                            rounded-full
                            px-2.5
                            py-1
                            text-xs
                            font-semibold
                            text-white
                          "
                          style={{ background: role.tone }}
                        >
                          <Icon size={12} />
                          {role.label}
                        </span>

                        <GhostButton
                          onClick={() => editFromList(u)}
                          className="text-xs"
                        >
                          Edit
                        </GhostButton>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

        </div>

      </Card>

    </div>
  );
}