import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "../lib/database";
import { db } from "../lib/backend";

import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  CreditCard,
  Eye,
  IndianRupee,
  Loader2,
  Receipt,
  Search,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

/* =========================================================
   HELPERS
========================================================= */

function toDate(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function formatAmount(amount, currency = "INR") {
  const value = Number(amount) || 0;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(date) {
  if (!date) return "—";

  return date.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeStatus(status) {
  const value = String(status || "paid").toLowerCase();

  if (
    value === "paid" ||
    value === "success" ||
    value === "successful" ||
    value === "captured"
  ) {
    return "paid";
  }

  if (
    value === "pending" ||
    value === "processing" ||
    value === "created"
  ) {
    return "pending";
  }

  return "failed";
}

function statusLabel(status) {
  if (status === "paid") return "Paid";
  if (status === "pending") return "Pending";

  return "Failed";
}

function statusClasses(status) {
  if (status === "paid") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "pending") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-red-50 text-red-700";
}

function getUserName(user) {
  if (!user) return "";

  return (
    user.name ||
    user.displayName ||
    user.fullName ||
    [user.firstName, user.lastName]
      .filter(Boolean)
      .join(" ")
  );
}

/* =========================================================
   PAYMENT DETAILS MODAL
========================================================= */

function PaymentDetailsModal({
  payment,
  onClose,
}) {
  if (!payment) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-[#0F172A] px-5 py-4 text-white">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />

            <h3 className="font-bold">
              Payment details
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 transition hover:bg-white/15"
            aria-label="Close payment details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-2xl bg-slate-50 p-4">
            <DetailRow
              label="Status"
              value={
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusClasses(
                    payment.status
                  )}`}
                >
                  {statusLabel(payment.status)}
                </span>
              }
            />

            <DetailRow
              label="Student"
              value={payment.studentName}
            />

            <DetailRow
              label="Email"
              value={payment.studentEmail}
            />

            <DetailRow
              label="Course"
              value={payment.courseName}
            />

            <DetailRow
              label="Amount"
              value={formatAmount(
                payment.amount,
                payment.currency
              )}
              strong
            />

            <DetailRow
              label="Date"
              value={formatDateTime(payment.paidAt)}
            />

            <DetailRow
              label="Razorpay payment ID"
              value={payment.razorpayPaymentId}
              mono
            />

            <DetailRow
              label="Supabase database record ID"
              value={payment.id}
              mono
            />
          </div>

          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            This record was created by the current client-side
            payment flow. A server/webhook is needed to independently
            verify Razorpay payments.
          </p>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full bg-[#0F172A] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#1E293B]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  strong = false,
  mono = false,
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-200 py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
      <span className="shrink-0 text-xs text-slate-500">
        {label}
      </span>

      <span
        className={`break-words text-sm text-[#0F172A] sm:text-right ${strong ? "font-bold" : "font-medium"
          } ${mono ? "font-mono text-xs" : ""
          }`}
      >
        {value || "—"}
      </span>
    </div>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  title,
  value,
  icon,
  color = "green",
}) {
  const styles = {
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-1 text-xl font-black text-[#0F172A]">
            {value}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles[color]}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   ADMIN PAYMENTS PAGE
========================================================= */

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");

  const [selectedPayment, setSelectedPayment] =
    useState(null);

  /* =======================================================
     LOAD PAYMENT RECORDS
  ======================================================= */

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "payments"),
      (snapshot) => {
        const rows = snapshot.docs.map(
          (paymentDoc) => {
            const data = paymentDoc.data();

            return {
              id: paymentDoc.id,

              userId:
                data.userId ||
                data.uid ||
                data.studentId ||
                "",

              studentName:
                data.studentName ||
                data.userName ||
                "",

              studentEmail:
                data.studentEmail ||
                data.userEmail ||
                data.email ||
                "",

              courseId: data.courseId || "",

              courseName:
                data.courseName ||
                data.courseTitle ||
                "Untitled course",

              amount:
                Number(
                  data.amount ??
                  data.paymentAmount ??
                  0
                ) || 0,

              currency:
                data.currency || "INR",

              status: normalizeStatus(data.status),

              paidAt:
                toDate(data.paidAt) ||
                toDate(data.createdAt),

              razorpayPaymentId:
                data.razorpayPaymentId ||
                data.razorpay_payment_id ||
                paymentDoc.id,
            };
          }
        );

        rows.sort((a, b) => {
          const firstTime =
            a.paidAt?.getTime() || 0;

          const secondTime =
            b.paidAt?.getTime() || 0;

          return secondTime - firstTime;
        });

        setPayments(rows);
        setLoading(false);
      },
      (snapshotError) => {
        console.error(
          "Unable to load payments:",
          snapshotError
        );

        setError(
          "Unable to load payment records. Check the Supabase database rules and your admin role."
        );

        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  /* =======================================================
     LOAD USER NAMES
  ======================================================= */

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const nextUsers = {};

        snapshot.docs.forEach((userDoc) => {
          nextUsers[userDoc.id] = userDoc.data();
        });

        setUsersById(nextUsers);
      },
      (snapshotError) => {
        console.warn(
          "Unable to load user names:",
          snapshotError
        );
      }
    );

    return unsubscribe;
  }, []);

  /* =======================================================
     MERGE PAYMENT + STUDENT INFORMATION
  ======================================================= */

  const paymentRows = useMemo(() => {
    return payments.map((payment) => {
      const user = usersById[payment.userId];

      return {
        ...payment,

        studentName:
          payment.studentName ||
          getUserName(user) ||
          "Unknown student",

        studentEmail:
          payment.studentEmail ||
          user?.email ||
          "—",
      };
    });
  }, [payments, usersById]);

  /* =======================================================
     TOTALS
  ======================================================= */

  const totals = useMemo(() => {
    const paid = paymentRows.filter(
      (payment) => payment.status === "paid"
    );

    const pending = paymentRows.filter(
      (payment) => payment.status === "pending"
    );

    const failed = paymentRows.filter(
      (payment) => payment.status === "failed"
    );

    return {
      revenue: paid.reduce(
        (total, payment) =>
          total + payment.amount,
        0
      ),

      paid: paid.length,
      pending: pending.length,
      failed: failed.length,
    };
  }, [paymentRows]);

  /* =======================================================
     FILTERED PAYMENT LIST
  ======================================================= */

  const filteredPayments = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return paymentRows.filter((payment) => {
      const matchesStatus =
        statusFilter === "all" ||
        payment.status === statusFilter;

      const searchableText = [
        payment.id,
        payment.razorpayPaymentId,
        payment.studentName,
        payment.studentEmail,
        payment.userId,
        payment.courseName,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !searchText ||
        searchableText.includes(searchText);

      return matchesStatus && matchesSearch;
    });
  }, [
    paymentRows,
    search,
    statusFilter,
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-[#0F172A] sm:text-3xl">
          Payment records
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Review recorded course payments and student enrollments.
        </p>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

          <span className="flex-1">
            {error}
          </span>

          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Close error"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Recorded revenue"
          value={formatAmount(totals.revenue)}
          color="green"
          icon={<IndianRupee className="h-5 w-5" />}
        />

        <StatCard
          title="Successful payments"
          value={totals.paid}
          color="blue"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />

        <StatCard
          title="Pending payments"
          value={totals.pending}
          color="amber"
          icon={<Clock3 className="h-5 w-5" />}
        />

        <StatCard
          title="Failed payments"
          value={totals.failed}
          color="red"
          icon={<XCircle className="h-5 w-5" />}
        />
      </div>

      <section className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="font-bold text-[#0F172A]">
              Transactions
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              {filteredPayments.length} record
              {filteredPayments.length === 1
                ? ""
                : "s"}{" "}
              shown
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search payment, student, course..."
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:w-64"
              />
            </label>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500"
            >
              <option value="all">
                All statuses
              </option>

              <option value="paid">
                Paid
              </option>

              <option value="pending">
                Pending
              </option>

              <option value="failed">
                Failed
              </option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading payment records...
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
            <CreditCard className="h-10 w-10 text-slate-300" />

            <h3 className="mt-4 font-bold text-slate-700">
              No payment records found
            </h3>

            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Payments recorded in the Supabase database
              <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                payments
              </code>
              collection will appear here.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">
                      Student
                    </th>

                    <th className="px-5 py-3 font-semibold">
                      Course
                    </th>

                    <th className="px-5 py-3 font-semibold">
                      Amount
                    </th>

                    <th className="px-5 py-3 font-semibold">
                      Status
                    </th>

                    <th className="px-5 py-3 font-semibold">
                      Date
                    </th>

                    <th className="px-5 py-3 font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredPayments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-t border-slate-100 transition hover:bg-emerald-50/30"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                            <UserRound className="h-4 w-4" />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[#0F172A]">
                              {payment.studentName}
                            </p>

                            <p className="truncate text-xs text-slate-500">
                              {payment.studentEmail}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <p className="max-w-48 truncate text-sm font-medium text-slate-700">
                          {payment.courseName}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm font-bold text-[#0F172A]">
                        {formatAmount(
                          payment.amount,
                          payment.currency
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusClasses(
                            payment.status
                          )}`}
                        >
                          {statusLabel(payment.status)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-500">
                        {formatDateTime(payment.paidAt)}
                      </td>

                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedPayment(payment)
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F172A] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#1E293B]"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {filteredPayments.map((payment) => (
                <button
                  key={payment.id}
                  type="button"
                  onClick={() =>
                    setSelectedPayment(payment)
                  }
                  className="w-full p-4 text-left transition hover:bg-emerald-50/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-[#0F172A]">
                        {payment.studentName}
                      </p>

                      <p className="mt-1 truncate text-xs text-slate-500">
                        {payment.courseName}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusClasses(
                        payment.status
                      )}`}
                    >
                      {statusLabel(payment.status)}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="font-bold text-[#0F172A]">
                      {formatAmount(
                        payment.amount,
                        payment.currency
                      )}
                    </span>

                    <span className="text-xs text-slate-500">
                      {formatDateTime(payment.paidAt)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <PaymentDetailsModal
        payment={selectedPayment}
        onClose={() => setSelectedPayment(null)}
      />
    </div>
  );
}
