export function payableAmount(course) {
  const price = Number(course.price);
  const discount = Number(course.discount_price);
  const amount = Math.round((discount > 0 && discount < price ? discount : price) * 100);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("This course does not require a payment.");
  return amount;
}
export async function validSignature(secret, message, signature) {
  if (typeof signature !== "string" || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const bytes = Uint8Array.from(signature.match(/../g), (hex) => parseInt(hex, 16));
  return crypto.subtle.verify("HMAC", key, bytes, encoder.encode(message));
}
export function assertCapturedPayment(payment, order) {
  if (payment.order_id !== order.order_id || Number(payment.amount) !== Number(order.amount) || payment.currency !== order.currency || payment.status !== "captured") {
    throw new Error("The captured payment does not match this order.");
  }
}
