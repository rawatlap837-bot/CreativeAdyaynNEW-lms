# Creative Adyayan LMS

React and Tailwind LMS backed by Supabase.

## Local setup

1. Run `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Add the Supabase project URL and publishable key.
4. Run `npm run dev`.

## Supabase backend

- Database schema, functions, RLS policies, and storage policies are defined in `supabase/migrations/`.
- Payment endpoints are in `supabase/functions/`.
- Browser-side database, authentication, and storage clients are in `src/lib/`.

## Payment receipts by email

Successful online payments send a receipt through Resend from the `lms-payments` Edge Function. Configure these Supabase Edge Function secrets before deploying:

- `RESEND_API_KEY`: a Resend API key.
- `PAYMENT_RECEIPT_FROM`: a sender address on a domain verified in Resend, for example `Creative Adhyayan <receipts@your-verified-domain.com>`.

Deploy both `lms-payments` and `lms-payment-webhook` so receipts send whether the student completes checkout in the open browser or Razorpay reports capture through its webhook. If email delivery is unavailable, payment verification and course enrollment still succeed, and the checkout displays that the receipt is available in the student dashboard.

## Admin refunds

Administrators can issue a full refund for a captured online one-time payment from **Admin -> Payments -> View**. The server claims the payment before contacting Razorpay to prevent duplicate refund requests. Course access is revoked only after Razorpay reports that the refund was processed. EMI and offline refunds require manual review and are intentionally unavailable from the automatic refund button.

After deploying the current functions:

1. In Razorpay, configure the webhook URL as `https://YOUR_PROJECT_REF.supabase.co/functions/v1/lms-payment-webhook`.
2. Subscribe it to `payment.captured`, `refund.processed`, and `refund.failed`.
3. Keep the matching webhook secret in the Supabase Edge Function secret `RAZORPAY_WEBHOOK_SECRET`.
4. Deploy both functions again whenever their code changes.

Test refunds with a controlled Razorpay test-mode payment before enabling live-mode refunds. An administrator must confirm the destructive access-revocation step in the UI.

Never commit `.env.local`, service-role keys, or payment secrets.
