import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { payableAmount, validSignature, assertCapturedPayment } from "../_shared/payments.js";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const keyId = Deno.env.get("RAZORPAY_KEY_ID") || "";
const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") || "";
const allowedOrigins = (Deno.env.get("APP_ORIGINS") || "http://localhost:5173").split(",").map((s) => s.trim());

async function razorpay(path: string, body?: Record<string, unknown>) {
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error("Payment provider is unavailable. Please try again.");
  return data;
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") || "";
  const headers = {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json", Vary: "Origin",
  };
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
    if (!keyId || !keySecret) return reply({ error: "Online payment is not configured yet." }, 503);
    const body = await request.json();
    if (body.action === "create-order") {
      if (typeof body.courseId !== "string") return reply({ error: "Course is required." }, 400);
      const { data: course, error } = await admin.from("lms_courses").select("id,title,price,discount_price,currency,status").eq("id", body.courseId).single();
      if (error || course.status !== "published") return reply({ error: "Course is unavailable." }, 404);
      const { data: enrollment, error: enrollmentError } = await admin.from("lms_enrollments").select("id,status").eq("student_id", user.id).eq("course_id", course.id).maybeSingle();
      if (enrollmentError) throw enrollmentError;
      if (enrollment?.status === "active") return reply({ error: "You are already enrolled. Refresh this page." }, 409);
      const { count, error: countError } = await admin.from("lms_payments").select("id", { count: "exact", head: true }).eq("student_id", user.id).gte("created_at", new Date(Date.now() - 60000).toISOString());
      if (countError) throw countError;
      if ((count || 0) >= 5) return reply({ error: "Please wait a minute before retrying payment." }, 429);
      const amount = payableAmount(course);
      const order = await razorpay("orders", { amount, currency: course.currency || "INR", receipt: crypto.randomUUID(), notes: { courseId: course.id, studentId: user.id } });
      const { error: insertError } = await admin.from("lms_payments").insert({
        id: order.id, order_id: order.id, student_id: user.id, course_id: course.id,
        amount, currency: order.currency, status: "created",
      });
      if (insertError) throw insertError;
      return reply({ keyId, orderId: order.id, amount, currency: order.currency });
    }
    if (body.action === "verify") {
      if (!/^order_[a-zA-Z0-9]+$/.test(body.razorpay_order_id || "") || !/^pay_[a-zA-Z0-9]+$/.test(body.razorpay_payment_id || "")) return reply({ error: "Invalid payment reference." }, 400);
      const { data: order, error } = await admin.from("lms_payments").select("*").eq("order_id", body.razorpay_order_id).eq("student_id", user.id).eq("course_id", body.courseId).single();
      if (error || !order) return reply({ error: "Payment order not found." }, 404);
      if (!await validSignature(keySecret, `${order.order_id}|${body.razorpay_payment_id}`, body.razorpay_signature)) return reply({ error: "Payment verification failed." }, 400);
      let payment = await razorpay(`payments/${body.razorpay_payment_id}`);
      // Capture only this authenticated student's matching, authorized payment.
      if (payment.status === "authorized" && payment.order_id === order.order_id && Number(payment.amount) === Number(order.amount) && payment.currency === order.currency) {
        payment = await razorpay(`payments/${body.razorpay_payment_id}/capture`, { amount: Number(order.amount), currency: order.currency });
      }
      assertCapturedPayment(payment, order);
      const { data: enrollment, error: confirmError } = await admin.rpc("lms_confirm_payment", { order_ref: order.order_id, payment_ref: payment.id });
      if (confirmError) throw confirmError;
      return reply({ enrollment });
    }
    return reply({ error: "Unknown payment action." }, 400);
  } catch (error) {
    console.error("Payment operation failed", error instanceof Error ? error.message : "unknown");
    return reply({ error: "Payment could not be completed. If charged, keep your payment ID and contact the institute." }, 400);
  }
});
