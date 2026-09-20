import { supabase } from "../lib/supabase";
import { fromRow } from "../lib/records";
async function invoke(action, payload) {
  const { data, error } = await supabase.functions.invoke("lms-payments", { body: { action, ...payload } });
  if (error) {
    let message = error.message;
    try { message = (await error.context?.json())?.error || message; } catch { /* transport error */ }
    throw new Error(message || "Payment service is unavailable.");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const createPaymentOrder = (courseId) => invoke("create-order", { courseId });
export async function verifyPayment(payment) {
  const result = await invoke("verify", payment);
  return fromRow("enrollments", result.enrollment);
}
