import { useEffect, useState } from "react";
import { AlertCircle, CalendarClock, CheckCircle2, CreditCard, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabase";
import { auth } from "../lib/backend";
import { createEmiInstallmentOrder } from "../services/Payments";

const money = (minor, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(minor || 0) / 100);
const date = (value) => value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
const loadRazorpay = () => new Promise((resolve) => {
  if (window.Razorpay) return resolve(true);
  const script = document.createElement("script");
  script.src = "https://checkout.razorpay.com/v1/checkout.js";
  script.onload = () => resolve(true);
  script.onerror = () => resolve(false);
  document.body.appendChild(script);
});

export default function StudentPayments() {
  const [payments, setPayments] = useState([]);
  const [plans, setPlans] = useState([]);
  const [courses, setCourses] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    if (!auth.currentUser) { setError("Sign in to view your payment records."); setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const [paymentResult, planResult] = await Promise.all([
        supabase.from("lms_payments").select("id,course_id,order_id,payment_id,amount,currency,status,payment_mode,installment_number,installment_count,due_at,created_at,updated_at,metadata").eq("student_id", auth.currentUser.uid).order("created_at", { ascending: false }),
        supabase.from("lms_installment_plans").select("id,course_id,total_amount,registration_amount,remaining_amount,registration_paid,installment_count,installment_amount,paid_installments,next_due_at,status,created_at,lms_emi_installments(id,installment_number,amount,due_at,status)").eq("student_id", auth.currentUser.uid).order("created_at", { ascending: false }),
      ]);
      if (paymentResult.error) throw paymentResult.error;
      if (planResult.error) throw planResult.error;
      const courseIds = [...new Set([...(paymentResult.data || []).map((row) => row.course_id), ...(planResult.data || []).map((row) => row.course_id)])];
      const courseResult = courseIds.length ? await supabase.from("lms_courses").select("id,title").in("id", courseIds) : { data: [], error: null };
      if (courseResult.error) throw courseResult.error;
      setPayments(paymentResult.data || []);
      setPlans(planResult.data || []);
      setCourses(Object.fromEntries((courseResult.data || []).map((row) => [row.id, row.title])));
    } catch (err) {
      setError(err?.message || "Unable to load payment records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function payNext(plan) {
    const installment = [...(plan.lms_emi_installments || [])]
      .filter((row) => ["unpaid", "created", "overdue"].includes(row.status))
      .sort((a, b) => a.installment_number - b.installment_number)[0];
    if (!installment) return setError("No payable installment was found.");
    setPaying(plan.id); setError(""); setMessage("");
    try {
      if (!await loadRazorpay()) throw new Error("Razorpay Checkout could not be loaded.");
      const order = await createEmiInstallmentOrder(installment.id);
      const checkout = new window.Razorpay({
        key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency,
        name: "Creative Adhyayan", description: `${courses[plan.course_id] || "Course"} — installment ${order.installmentNumber}`,
        prefill: { name: auth.currentUser?.displayName || "", email: auth.currentUser?.email || "", contact: auth.currentUser?.phoneNumber || "" },
        handler: (response) => { setMessage(`Payment submitted. Razorpay webhook verification is pending. Payment ID: ${response.razorpay_payment_id}`); setPaying(""); setTimeout(load, 2500); },
        modal: { ondismiss: () => setPaying("") }, theme: { color: "#7c3aed" },
      });
      checkout.on("payment.failed", (response) => { setError(response?.error?.description || "Payment failed."); setPaying(""); });
      checkout.open();
    } catch (err) { setError(err?.message || "Unable to start payment."); setPaying(""); }
  }

  if (loading) return <div className="flex min-h-64 items-center justify-center gap-3 text-slate-600"><Loader2 className="h-5 w-5 animate-spin" />Loading payment records…</div>;
  if (error) return <div role="alert" className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"><div className="flex items-center gap-2 font-semibold"><AlertCircle className="h-5 w-5" />Could not load payments</div><p className="mt-2">{error}</p><button onClick={load} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 font-semibold text-red-700"><RefreshCw className="h-4 w-4" />Try again</button></div>;

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header><p className="text-xs font-bold uppercase tracking-[0.15em] text-violet-600">Account</p><h1 className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">Payments and EMIs</h1><p className="mt-2 text-sm text-slate-600">Your recorded transactions, installment progress, and upcoming payments.</p></header>
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div>}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="flex items-center gap-2 font-bold text-slate-900"><CalendarClock className="h-5 w-5 text-violet-600" />EMI plans</h2>
          {!plans.length ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No EMI plans found.</p> : <div className="mt-4 space-y-3">{plans.map((plan) => {
            const dueDate = plan.next_due_at ? new Date(plan.next_due_at) : null;
            const isDue = dueDate && dueDate.getTime() <= Date.now() && plan.status !== "completed";
            const baseInstallment = Math.floor(Number(plan.remaining_amount) / Math.max(1, Number(plan.installment_count)));
            const extraPaiseCount = Number(plan.remaining_amount) % Math.max(1, Number(plan.installment_count));
            const paidInstallmentTotal = baseInstallment * Number(plan.paid_installments) + Math.min(Number(plan.paid_installments), extraPaiseCount);
            const remainingBalance = plan.registration_paid ? Math.max(0, Number(plan.remaining_amount) - paidInstallmentTotal) : Number(plan.total_amount);
            const nextInstallment = Number(plan.paid_installments) + 1;
            const dueAmount = plan.registration_paid ? baseInstallment + (nextInstallment <= extraPaiseCount ? 1 : 0) : Number(plan.registration_amount);
            const state = plan.status === "completed" ? "Completed" : isDue || plan.status === "overdue" ? "Payment due" : plan.registration_paid ? "Active" : "Registration pending";
            return <article key={plan.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{courses[plan.course_id] || "Course"}</h3><p className="mt-1 text-xs text-slate-500">{plan.installment_count}-month installment plan</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${state === "Payment due" || state === "Registration pending" ? "bg-amber-100 text-amber-800" : state === "Completed" ? "bg-emerald-100 text-emerald-800" : "bg-violet-100 text-violet-800"}`}>{state}</span></div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-slate-500">Plan total</p><p className="mt-1 font-bold text-slate-900">{money(plan.total_amount)}</p></div><div><p className="text-xs text-slate-500">Balance remaining</p><p className="mt-1 font-bold text-slate-900">{money(remainingBalance)}</p></div><div><p className="text-xs text-slate-500">Installments paid</p><p className="mt-1 font-semibold text-slate-800">{plan.registration_paid ? Number(plan.paid_installments) : 0} / {plan.installment_count}</p></div><div><p className="text-xs text-slate-500">Next amount due</p><p className="mt-1 font-semibold text-slate-800">{state === "Completed" ? "—" : money(dueAmount)}</p></div></div>
              <p className="mt-3 text-xs text-slate-500">{state === "Completed" ? "All scheduled payments are complete." : dueDate ? `${isDue ? "Due" : "Next due"}: ${date(plan.next_due_at)}` : "Registration payment has not been recorded yet."}</p>
              {state !== "Completed" && <button type="button" disabled={paying === plan.id} onClick={() => payNext(plan)} className="mt-3 w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">{paying === plan.id ? "Opening secure checkout…" : "Pay next installment"}</button>}
            </article>;
          })}</div>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="flex items-center gap-2 font-bold text-slate-900"><CreditCard className="h-5 w-5 text-violet-600" />Payment history</h2>
          {!payments.length ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No payment transactions found yet.</p> : <div className="mt-4 space-y-3">{payments.map((payment) => {
            const paid = payment.status === "paid" || payment.status === "captured";
            const label = payment.status === "paid" || payment.status === "captured" ? "Paid" : payment.status === "created" ? "Awaiting payment" : payment.status;
            return <article key={payment.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{courses[payment.course_id] || "Course"}</h3><p className="mt-1 text-xs capitalize text-slate-500">{payment.payment_mode === "emi" ? payment.installment_number === 0 ? "EMI registration" : `EMI ${payment.installment_number || ""}` : "One-time payment"}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${paid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{label}</span></div><div className="mt-3 flex items-center justify-between gap-3"><span className="text-lg font-bold text-slate-900">{money(payment.amount, payment.currency)}</span><span className="text-xs text-slate-500">{date(payment.created_at)}</span></div>{payment.payment_id && <p className="mt-2 break-all text-xs text-slate-500">Payment ID: {payment.payment_id}</p>}</article>;
          })}</div>}
        </section>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><p>Need help with a payment? Use the WhatsApp support button and include the course name and payment ID if available.</p></div>
    </section>
  );
}
