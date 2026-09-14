import { useState } from "react";
import {
  Search,
  ShieldCheck,
  ShieldOff,
  UserCheck,
} from "lucide-react";

import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";

import { db } from "../firebase/Firebase.js";

import {
  AT,
  Card,
  PrimaryButton,
  EmptyState,
} from "./AdminUI.jsx";

/**
 * Promote or demote a user to admin by email.
 *
 * Requires the user to have signed up at least once so that
 * users/{uid} exists with an email field.
 */

export default function Admins() {
  const [email, setEmail] = useState("");

  const [status, setStatus] = useState("idle");
  // idle | searching | found | notfound | error

  const [found, setFound] = useState(null);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);

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
     CHANGE ROLE
  ============================================================ */

  const setRole = async (newRole) => {
    if (!found) return;

    setUpdating(true);
    setError("");

    try {
      await updateDoc(
        doc(db, "users", found.id),
        {
          role: newRole,
        }
      );

      setFound({
        ...found,
        role: newRole,
      });
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
     UI
  ============================================================ */

  return (
    <div className="w-full min-w-0 space-y-4 overflow-x-hidden">

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
                  ROLE ACTION
              -------------------------------------------------- */}

              <div className="w-full shrink-0 sm:w-auto">

                {found.role === "admin" ? (
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() =>
                      setRole("student")
                    }
                    className="
                      flex
                      w-full
                      items-center
                      justify-center
                      gap-2
                      rounded-xl
                      px-4
                      py-2.5
                      text-sm
                      font-semibold
                      text-white
                      transition
                      disabled:cursor-not-allowed
                      disabled:opacity-60
                      sm:w-auto
                    "
                    style={{
                      background:
                        AT.danger,
                    }}
                  >
                    {updating ? (
                      <span
                        className="
                          h-4
                          w-4
                          animate-spin
                          rounded-full
                          border-2
                          border-white/40
                          border-t-white
                        "
                      />
                    ) : (
                      <ShieldOff
                        size={16}
                      />
                    )}

                    {updating
                      ? "Updating..."
                      : "Remove admin"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() =>
                      setRole("admin")
                    }
                    className="
                      flex
                      w-full
                      items-center
                      justify-center
                      gap-2
                      rounded-xl
                      px-4
                      py-2.5
                      text-sm
                      font-semibold
                      text-white
                      transition
                      disabled:cursor-not-allowed
                      disabled:opacity-60
                      sm:w-auto
                    "
                    style={{
                      background:
                        AT.chrome,
                    }}
                  >
                    {updating ? (
                      <span
                        className="
                          h-4
                          w-4
                          animate-spin
                          rounded-full
                          border-2
                          border-white/40
                          border-t-white
                        "
                      />
                    ) : (
                      <ShieldCheck
                        size={16}
                      />
                    )}

                    {updating
                      ? "Updating..."
                      : "Make admin"}
                  </button>
                )}

              </div>

            </div>
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

    </div>
  );
}