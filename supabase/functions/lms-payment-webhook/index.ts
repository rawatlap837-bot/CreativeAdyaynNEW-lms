import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { validSignature, assertCapturedPayment } from "../_shared/payments.js";
import { sendPaymentReceipt } from "../_shared/receipts.js";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

async function updateRefund(event: any) {
  const refund = event.payload?.refund?.entity;
  if (!refund?.payment_id) throw new Error("Refund payment reference is missing.");
  const { data: order, error } = await admin.from("lms_payments").select("*").eq("payment_id", refund.payment_id).single();
  if (error || !order) throw new Error("Refunded payment was not found; retry delivery.");
  const now = new Date().toISOString();
  const metadata = {
    ...(order.metadata || {}),
    refundId: refund.id,
    refundStatus: refund.status,
    refundAmount: Number(refund.amount || order.amount),
    ...(refund.status === "processed" ? { refundProcessedAt: now } : { refundFailedAt: now }),
  };
  const status = refund.status === "processed" ? "refunded" : "refund_failed";
  const { error: paymentError } = await admin.from("lms_payments").update({ status, metadata, updated_at: now }).eq("id", order.id);
  if (paymentError) throw paymentError;
  if (refund.status === "processed" && order.payment_mode !== "emi") {
    const { error: enrollmentError } = await admin.from("lms_enrollments")
      .update({ status: "refunded", payment_status: "refunded", updated_at: now })
      .eq("student_id", order.student_id)
      .eq("course_id", order.course_id);
    if (enrollmentError) throw enrollmentError;
  }
}

// Completes captured payments even if the student closes the checkout tab.
Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  if (!secret) return new Response("Webhook is not configured", { status: 503 });
  const raw = await request.text();
  if (!await validSignature(secret, raw, request.headers.get("x-razorpay-signature"))) return new Response("Invalid signature", { status: 401 });
  try {
    const event = JSON.parse(raw);
    if (event.event === "refund.processed" || event.event === "refund.failed") {
      await updateRefund(event);
      return new Response("OK");
    }
    if (event.event !== "payment.captured") return new Response("Ignored", { status: 200 });
    const payment = event.payload?.payment?.entity;
    const { data: order, error } = await admin.from("lms_payments").select("*").eq("order_id", payment?.order_id).single();
    if (error || !order) throw new Error("Order not found; retry delivery.");
    assertCapturedPayment(payment, order);
    const { error: confirmError } = await admin.rpc("lms_confirm_payment", { order_ref: order.order_id, payment_ref: payment.id });
    if (confirmError) throw confirmError;
    const [{ data: student }, { data: course }] = await Promise.all([
      admin.from("lms_profiles").select("name,email").eq("id", order.student_id).maybeSingle(),
      admin.from("lms_courses").select("title").eq("id", order.course_id).maybeSingle(),
    ]);
    await sendPaymentReceipt({
      payment: { ...order, ...payment, payment_id: payment.id, payment_mode: order.payment_mode, installment_number: order.installment_number },
      courseTitle: course?.title || "Course",
      recipientEmail: student?.email || "",
      recipientName: student?.name || "Student",
    });
    return new Response("OK");
  } catch {
    return new Response("Unable to process payment; retry delivery", { status: 500 });
  }
});
