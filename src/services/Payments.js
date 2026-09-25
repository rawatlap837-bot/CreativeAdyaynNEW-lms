import { supabase } from "../lib/supabase";
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
export const createPaymentOrder = (courseId, paymentMode = "one_time", installmentCount = null) => invoke("create-order", { courseId, paymentMode, installmentCount });
export const getInstallmentPlan = (courseId) => invoke("get-installment-plan", { courseId });
export const syncEmiReminders = () => invoke("sync-emi-reminders", {});
export const refundPayment = (paymentId, reason) => invoke("refund-payment", { paymentId, reason });
export async function createEmiInstallmentOrder(installmentId) {
  const { data, error } = await supabase.functions.invoke("lms-emi-create-order", { body: { installmentId } });
  if (error) throw new Error(error.message || "Payment service is unavailable.");
  if (data?.error) throw new Error(data.error);
  return data;
}
