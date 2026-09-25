import LegalPage from "./LegalPage";

export default function RefundPolicy() {
  return (
    <LegalPage eyebrow="Payments" title="Refund and Cancellation Policy">
      <section><h2>Requesting a refund</h2><p>Send the request to contact@creativeadhyayan.com with the learner's registered email address, course name, payment ID, reason, and supporting details. Do not send card, bank, OTP, or password information.</p></section>
      <section><h2>Eligibility</h2><p>Refund eligibility depends on the course terms, the reason for the request, content already consumed, live sessions attended, downloadable material accessed, and applicable consumer law. Unless a course page states a different mandatory period, requests should be submitted within seven calendar days of payment. Submitting a request does not itself guarantee approval.</p></section>
      <section><h2>Non-refundable situations</h2><p>A refund may be declined where a learner has substantially consumed or downloaded the course, received a certificate, violated the Terms, requested a refund outside the applicable period, or where the charge relates to a completed service, except where applicable law requires otherwise.</p></section>
      <section><h2>EMI and offline payments</h2><p>EMI refunds require review of registration fees, installments already paid, course usage, remaining balance, and access status. Offline payments require manual verification. These refunds are not issued automatically through the administrator dashboard.</p></section>
      <section><h2>Approved refunds</h2><p>Approved online refunds are sent to the original payment method through Razorpay. Course access may be revoked when a full refund is processed. Bank or payment-network processing commonly takes 5–10 business days after processing, although the final timing is controlled by the payment provider and issuing bank.</p></section>
      <section><h2>Duplicate or incorrect charges</h2><p>Contact us promptly with the payment IDs if you believe you were charged twice or charged an incorrect amount. We will investigate payment records and correct a verified error.</p></section>
    </LegalPage>
  );
}
