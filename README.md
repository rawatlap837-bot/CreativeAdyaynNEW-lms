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

Never commit `.env.local`, service-role keys, or payment secrets.
