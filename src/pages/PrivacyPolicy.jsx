import LegalPage from "./LegalPage";

export default function PrivacyPolicy() {
  return (
    <LegalPage eyebrow="Legal" title="Privacy Policy">
      <section><h2>Information we collect</h2><p>We collect account details such as name, email address, phone number, role, course enrollment, attendance, assignment activity, learning progress, certificates, support messages, and payment references. Payment card or bank credentials are handled by Razorpay and are not stored by this LMS.</p></section>
      <section><h2>How information is used</h2><ul><li>Provide authentication, courses, progress tracking, assessments, attendance, certificates, and support.</li><li>Process and reconcile payments, installments, refunds, and receipts.</li><li>Protect accounts, prevent fraud, enforce access rules, and diagnose failures.</li><li>Send service messages concerning courses, payments, and account activity.</li></ul></section>
      <section><h2>Service providers</h2><p>Information may be processed by providers needed to operate the service, including Supabase for authentication and data storage, Vercel for website delivery, Razorpay for payments, Resend for transactional email, Google for configured sign-in or administrative Sheets workflows, and embedded video providers. Each provider processes information under its own terms and privacy commitments.</p></section>
      <section><h2>Sharing</h2><p>We do not sell personal information. Information is shared only with authorized staff, relevant instructors, service providers, or authorities when required to operate the LMS, protect users, comply with law, or respond to valid legal requests.</p></section>
      <section><h2>Retention and security</h2><p>Records are retained for as long as needed to deliver courses, meet accounting and legal obligations, resolve disputes, and protect the service. We use access controls and technical safeguards, but no internet system can guarantee absolute security.</p></section>
      <section><h2>Your choices</h2><p>You may request access, correction, or deletion of eligible personal information by contacting us. Some payment, tax, certificate, security, or dispute records may need to be retained where law or legitimate obligations require it.</p></section>
      <section><h2>Children</h2><p>If a learner is below the age at which they can independently consent under applicable law, a parent or lawful guardian must authorize the account and course purchase.</p></section>
    </LegalPage>
  );
}
