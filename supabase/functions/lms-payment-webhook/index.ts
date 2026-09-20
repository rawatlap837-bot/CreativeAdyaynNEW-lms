import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { validSignature, assertCapturedPayment } from "../_shared/payments.js";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

// Completes captured payments even if the student closes the checkout tab.
Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  if (!secret) return new Response("Webhook is not configured", { status: 503 });
  const raw = await request.text();
  if (!await validSignature(secret, raw, request.headers.get("x-razorpay-signature"))) return new Response("Invalid signature", { status: 401 });
  try {
    const event = JSON.parse(raw);
    if (event.event !== "payment.captured") return new Response("Ignored", { status: 200 });
    const payment = event.payload?.payment?.entity;
    const { data: order, error } = await admin.from("lms_payments").select("*").eq("order_id", payment?.order_id).single();
    if (error || !order) throw new Error("Order not found; retry delivery.");
    assertCapturedPayment(payment, order);
    const { error: confirmError } = await admin.rpc("lms_confirm_payment", { order_ref: order.order_id, payment_ref: payment.id });
    if (confirmError) throw confirmError;
    return new Response("OK");
  } catch {
    return new Response("Unable to process payment; retry delivery", { status: 500 });
  }
});
