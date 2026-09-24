import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { payableAmount, validSignature, assertCapturedPayment } from "../_shared/payments.js";
import { sendPaymentReceipt } from "../_shared/receipts.js";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const keyId = Deno.env.get("RAZORPAY_KEY_ID") || "";
const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") || "";
const allowedOrigins = (Deno.env.get("APP_ORIGINS") || "http://localhost:5173").split(",").map((value) => value.trim());
const REGISTRATION_FEE = 200000;

function durationMonths(value: unknown) {
  const text = String(value || "").toLowerCase();
  const match = text.match(/(\d+(?:\.\d+)?)\s*(year|month|week|day)/);
  if (!match) return 3;
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit.startsWith("year")) return Math.max(1, Math.ceil(amount * 12));
  if (unit.startsWith("month")) return Math.max(1, Math.ceil(amount));
  if (unit.startsWith("week")) return Math.max(1, Math.ceil(amount / 4));
  return Math.max(1, Math.ceil(amount / 30));
}

async function razorpay(path: string, body?: Record<string, unknown>) {
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error("Payment provider is unavailable. Please try again.");
  return data;
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") || "";
  const headers = { "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0], "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json", Vary: "Origin" };
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (origin && !allowedOrigins.includes(origin)) return reply({ error: "Origin is not allowed." }, 403);
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405);
  try {
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return reply({ error: "Sign in before paying." }, 401);
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return reply({ error: "Your session has expired. Sign in again." }, 401);
    const { data: profile, error: profileError } = await admin.from("lms_profiles").select("status").eq("id", user.id).single();
    if (profileError || profile?.status !== "active") return reply({ error: "Account is not active." }, 403);
    const body = await request.json();

    if (body.action === "get-installment-plan") {
      if (typeof body.courseId !== "string") return reply({ error: "Course is required." }, 400);
      const { data: plan, error } = await admin.from("lms_installment_plans").select("*").eq("student_id", user.id).eq("course_id", body.courseId).maybeSingle();
      if (error) throw error;
      if (plan?.registration_paid && plan.status === "active" && plan.next_due_at && new Date(plan.next_due_at).getTime() < Date.now()) {
        const { data: overduePlan, error: overdueError } = await admin.from("lms_installment_plans").update({ status: "overdue", updated_at: new Date().toISOString() }).eq("id", plan.id).select().single();
        if (overdueError) throw overdueError;
        await admin.from("lms_enrollments").update({ status: "payment_due", updated_at: new Date().toISOString() }).eq("student_id", user.id).eq("course_id", body.courseId).eq("payment_status", "emi");
        return reply({ plan: overduePlan });
      }
      return reply({ plan });
    }

    if (body.action === "sync-emi-reminders") {
      const { data: plans, error } = await admin.from("lms_installment_plans").select("*,lms_courses(title)").eq("student_id", user.id).eq("registration_paid", true).in("status", ["active", "overdue"]);
      if (error) throw error;
      const reminders = [];
      for (const plan of plans || []) {
        if (!plan.next_due_at || new Date(plan.next_due_at).getTime() > Date.now()) continue;
        const installmentNumber = Number(plan.paid_installments) + 1;
        const courseTitle = plan.lms_courses?.title || "your course";
        const message = `Monthly EMI ${installmentNumber} of ${plan.installment_count} for ${courseTitle} is due. Pay now to continue learning.`;
        const { error: planUpdateError } = await admin.from("lms_installment_plans").update({ status: "overdue", updated_at: new Date().toISOString() }).eq("id", plan.id);
        if (planUpdateError) throw planUpdateError;
        const { error: enrollmentError } = await admin.from("lms_enrollments").update({ status: "payment_due", updated_at: new Date().toISOString() }).eq("student_id", user.id).eq("course_id", plan.course_id).eq("payment_status", "emi");
        if (enrollmentError) throw enrollmentError;
        await admin.from("lms_notifications").upsert({ id: `emi_due_${plan.id}_${installmentNumber}`, recipient_id: user.id, course_id: plan.course_id, title: "EMI payment due", message, type: "payment_due", read: false, action_url: `/courses/${plan.course_id}`, metadata: { body: message, actionUrl: `/courses/${plan.course_id}`, planId: plan.id, installmentNumber } }, { onConflict: "id", ignoreDuplicates: true });
        reminders.push({ planId: plan.id, courseId: plan.course_id, installmentNumber });
      }
      return reply({ reminders });
    }

    if (!keyId || !keySecret) return reply({ error: "Online payment is not configured yet." }, 503);
    if (body.action === "create-order") {
      if (typeof body.courseId !== "string") return reply({ error: "Course is required." }, 400);
      const { data: course, error } = await admin.from("lms_courses").select("id,title,price,discount_price,currency,status,duration").eq("id", body.courseId).single();
      if (error || course.status !== "published") return reply({ error: "Course is unavailable." }, 404);
      const { data: enrollment, error: enrollmentError } = await admin.from("lms_enrollments").select("id,status").eq("student_id", user.id).eq("course_id", course.id).maybeSingle();
      if (enrollmentError) throw enrollmentError;
      const paymentMode = body.paymentMode === "emi" ? "emi" : "one_time";
      const { data: activePlan, error: activePlanError } = await admin.from("lms_installment_plans").select("id,status").eq("student_id", user.id).eq("course_id", course.id).maybeSingle();
      if (activePlanError) throw activePlanError;
      // Let students with an open EMI plan switch to a one-time payoff. The
      // confirmation RPC marks the enrollment paid; the completed plan no
      // longer blocks course access or future enrollment checks.
      if (enrollment?.status === "active" && paymentMode !== "emi") return reply({ error: "You are already enrolled. Refresh this page." }, 409);
      const { count, error: countError } = await admin.from("lms_payments").select("id", { count: "exact", head: true }).eq("student_id", user.id).gte("created_at", new Date(Date.now() - 60000).toISOString());
      if (countError) throw countError;
      if ((count || 0) >= 5) return reply({ error: "Please wait a minute before retrying payment." }, 429);

      const courseAmount = payableAmount(course);
      let amount = Math.round(courseAmount * 0.9);
      let planId: string | null = null;
      let installmentNumber: number | null = null;
      let installmentCount: number | null = null;
      let paymentLabel = "Full course payment (10% discount applied)";
      if (paymentMode === "emi") {
        const { data: existingPlan, error: planError } = await admin.from("lms_installment_plans").select("*").eq("student_id", user.id).eq("course_id", course.id).maybeSingle();
        if (planError) throw planError;
        let plan = existingPlan;
        if (!plan) {
          const months = durationMonths(course.duration);
          const registrationAmount = Math.min(REGISTRATION_FEE, courseAmount);
          const remainingAmount = Math.max(0, courseAmount - registrationAmount);
          const { data: newPlan, error: createPlanError } = await admin.from("lms_installment_plans").insert({ student_id: user.id, course_id: course.id, total_amount: courseAmount, registration_amount: registrationAmount, remaining_amount: remainingAmount, registration_paid: false, installment_count: months, installment_amount: Math.max(1, Math.ceil(remainingAmount / months)), next_due_at: null, status: "active" }).select().single();
          if (createPlanError) throw createPlanError;
          plan = newPlan;
        }
        if (plan.status === "completed") return reply({ error: "Your EMI plan is already complete." }, 409);
        if (plan.status === "cancelled") return reply({ error: "This EMI plan is no longer available." }, 409);
        planId = plan.id;
        installmentCount = Number(plan.installment_count);
        if (!plan.registration_paid) { amount = Number(plan.registration_amount); installmentNumber = 0; paymentLabel = "₹2,000 registration fee"; }
        else {
          if (Number(plan.paid_installments) >= installmentCount) return reply({ error: "Your EMI plan is already complete." }, 409);
          installmentNumber = Number(plan.paid_installments) + 1;
          const remainingAmount = Number(plan.remaining_amount);
          const baseAmount = Math.floor(remainingAmount / installmentCount);
          amount = baseAmount + (installmentNumber <= remainingAmount % installmentCount ? 1 : 0);
          paymentLabel = `Monthly EMI ${installmentNumber} of ${installmentCount}`;
        }
      }
      if (!Number.isSafeInteger(amount) || amount <= 0) return reply({ error: "No payment is due for this course." }, 409);
      const order = await razorpay("orders", { amount, currency: course.currency || "INR", receipt: crypto.randomUUID(), notes: { courseId: course.id, studentId: user.id, paymentMode, planId: planId || "", installmentNumber: String(installmentNumber || ""), paymentLabel } });
      const { error: insertError } = await admin.from("lms_payments").insert({ id: order.id, order_id: order.id, student_id: user.id, course_id: course.id, amount, currency: order.currency, status: "created", payment_mode: paymentMode, plan_id: planId, installment_number: installmentNumber, installment_count: installmentCount, due_at: paymentMode === "emi" ? new Date().toISOString() : null });
      if (insertError) throw insertError;
      return reply({ keyId, orderId: order.id, amount, currency: order.currency, paymentMode, planId, installmentNumber, installmentCount, paymentLabel });
    }
    if (body.action === "verify") {
      if (!/^order_[a-zA-Z0-9]+$/.test(body.razorpay_order_id || "") || !/^pay_[a-zA-Z0-9]+$/.test(body.razorpay_payment_id || "")) return reply({ error: "Invalid payment reference." }, 400);
      const { data: order, error } = await admin.from("lms_payments").select("*").eq("order_id", body.razorpay_order_id).eq("student_id", user.id).eq("course_id", body.courseId).single();
      if (error || !order) return reply({ error: "Payment order not found." }, 404);
      if (!await validSignature(keySecret, `${order.order_id}|${body.razorpay_payment_id}`, body.razorpay_signature)) return reply({ error: "Payment verification failed." }, 400);
      let payment = await razorpay(`payments/${body.razorpay_payment_id}`);
      if (payment.status === "authorized" && payment.order_id === order.order_id && Number(payment.amount) === Number(order.amount) && payment.currency === order.currency) payment = await razorpay(`payments/${body.razorpay_payment_id}/capture`, { amount: Number(order.amount), currency: order.currency });
      assertCapturedPayment(payment, order);
      const { data: enrollment, error: confirmError } = await admin.rpc("lms_confirm_payment", { order_ref: order.order_id, payment_ref: payment.id });
      if (confirmError) throw confirmError;
      const [{ data: course }, { data: profile }] = await Promise.all([
        admin.from("lms_courses").select("title").eq("id", order.course_id).maybeSingle(),
        admin.from("lms_profiles").select("name,email").eq("id", user.id).maybeSingle(),
      ]);
      const receiptEmail = await sendPaymentReceipt({
        payment: { ...order, ...payment, payment_id: payment.id, payment_mode: order.payment_mode, installment_number: order.installment_number },
        courseTitle: course?.title || "Course",
        recipientEmail: user.email || profile?.email || "",
        recipientName: profile?.name || user.user_metadata?.name || user.user_metadata?.full_name || "Student",
      });
      return reply({ enrollment, receiptEmail });
    }
    return reply({ error: "Unknown payment action." }, 400);
  } catch (error) {
    console.error("Payment operation failed", error instanceof Error ? error.message : "unknown");
    return reply({ error: error instanceof Error ? error.message : "Payment could not be completed. If charged, keep your payment ID and contact the institute." }, 400);
  }
});
