const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
}[character] || character));

const parseLegacySender = (value) => {
  const input = String(value || "").trim();
  const match = input.match(/^(.+?)\s*<([^<>]+)>$/);
  return match
    ? { name: match[1].trim().replace(/^['\"]|['\"]$/g, ""), email: match[2].trim() }
    : { name: "", email: input };
};

export async function sendPaymentReceipt({ payment, courseTitle, recipientEmail, recipientName }) {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  const legacySender = parseLegacySender(Deno.env.get("PAYMENT_RECEIPT_FROM"));
  const senderEmail = String(Deno.env.get("PAYMENT_RECEIPT_FROM_EMAIL") || legacySender.email).trim();
  const senderName = String(Deno.env.get("PAYMENT_RECEIPT_FROM_NAME") || legacySender.name || "Creative Adhyayan").trim();
  const replyToEmail = String(Deno.env.get("PAYMENT_RECEIPT_REPLY_TO") || senderEmail).trim();

  if (!apiKey || !senderEmail) {
    console.warn("Payment receipt email skipped: BREVO_API_KEY or PAYMENT_RECEIPT_FROM_EMAIL is not configured.");
    return { sent: false, reason: "email_not_configured" };
  }
  if (!recipientEmail) {
    console.warn("Payment receipt email skipped: customer has no email address.");
    return { sent: false, reason: "email_missing" };
  }

  const amount = Number(payment.amount || 0) / 100;
  const currency = String(payment.currency || "INR");
  const formattedAmount = new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount);
  const mode = payment.payment_mode === "emi"
    ? Number(payment.installment_number) === 0 ? "EMI registration payment" : `EMI installment ${payment.installment_number}`
    : "One-time course payment";
  const rawPaymentDate = payment.updated_at ?? payment.created_at ?? Date.now();
  const paymentTimestamp = typeof rawPaymentDate === "number"
    ? rawPaymentDate < 1_000_000_000_000 ? rawPaymentDate * 1000 : rawPaymentDate
    : Date.parse(String(rawPaymentDate));
  const paymentDate = new Date(Number.isFinite(paymentTimestamp) ? paymentTimestamp : Date.now()).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

  const safeCourse = escapeHtml(courseTitle || "Course");
  const safeName = escapeHtml(recipientName || "Student");
  const safeMode = escapeHtml(mode);
  const safeAmount = escapeHtml(formattedAmount);
  const safeDate = escapeHtml(paymentDate);
  const safePaymentId = escapeHtml(payment.payment_id || "-");
  const safeOrderId = escapeHtml(payment.order_id || "-");
  const html = `<!doctype html><html><body style="margin:0;background:#f7f5fc;font-family:Arial,sans-serif;color:#231942"><div style="max-width:600px;margin:32px auto;padding:28px;background:#fff;border-radius:16px"><h1 style="margin:0 0 8px;color:#5227ff;font-size:22px">Payment receipt</h1><p>Hello ${safeName},</p><p>We received your payment for <strong>${safeCourse}</strong>.</p><table style="width:100%;border-collapse:collapse;margin:24px 0"><tr><td style="padding:10px;border-bottom:1px solid #eee">Amount paid</td><td style="padding:10px;border-bottom:1px solid #eee;text-align:right"><strong>${safeAmount}</strong></td></tr><tr><td style="padding:10px;border-bottom:1px solid #eee">Payment type</td><td style="padding:10px;border-bottom:1px solid #eee;text-align:right">${safeMode}</td></tr><tr><td style="padding:10px;border-bottom:1px solid #eee">Date</td><td style="padding:10px;border-bottom:1px solid #eee;text-align:right">${safeDate}</td></tr><tr><td style="padding:10px;border-bottom:1px solid #eee">Payment ID</td><td style="padding:10px;border-bottom:1px solid #eee;text-align:right">${safePaymentId}</td></tr><tr><td style="padding:10px">Order ID</td><td style="padding:10px;text-align:right">${safeOrderId}</td></tr></table><p>Your course access and payment history have been updated in your student dashboard.</p><p style="margin-top:28px;color:#6b5f87">Creative Adhyayan</p></div></body></html>`;
  const text = [
    `Hello ${recipientName || "Student"},`,
    "",
    `We received your payment for ${courseTitle || "Course"}.`,
    `Amount paid: ${formattedAmount}`,
    `Payment type: ${mode}`,
    `Date: ${paymentDate}`,
    `Payment ID: ${payment.payment_id || "-"}`,
    `Order ID: ${payment.order_id || "-"}`,
    "",
    "Your course access and payment history have been updated in your student dashboard.",
    "",
    "Creative Adhyayan",
  ].join("\n");
  const idempotencyKey = `payment-receipt-${String(payment.payment_id || payment.order_id || crypto.randomUUID())}`.slice(0, 128);

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: recipientEmail, name: recipientName || "Student" }],
      replyTo: { email: replyToEmail, name: senderName },
      subject: `Payment receipt for ${courseTitle || "your course"}`,
      htmlContent: html,
      textContent: text,
      tags: ["payment-receipt"],
      headers: { "Idempotency-Key": idempotencyKey },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Brevo payment receipt error", response.status, detail.slice(0, 300));
    return { sent: false, reason: "email_delivery_failed" };
  }

  const result = await response.json();
  return { sent: true, emailId: result.messageId };
}
