# Creative Adhyayan LMS launch-readiness report

Date: 25 September 2026

## Decision

**Status: CONDITIONAL NO-GO until deployment configuration and a controlled payment/refund test are completed.**

The application builds and its automated authorization/payment tests pass, but the legal routes, production payment/auth configuration, dependency advisories, missing security headers, and one broken font reference should be resolved or explicitly accepted before admitting paying users.

## Verification completed

| Check | Result | Evidence |
| --- | --- | --- |
| Production Vite build | Pass with warnings | 3,419 modules transformed; production files emitted to `dist/` |
| Client/payment tests | Pass | 22/22 checks, including refund authorization and finalization invariants |
| Base Supabase/RLS tests | Pass | 41/41 checks |
| Course-save Supabase tests | Pass | 43/43 checks |
| Teacher-publish Supabase tests | Pass | 46/46 checks |
| Total automated checks | Pass | 152/152 checks |
| Tracked-source secret scan | Pass | No findings from Secretlint across source, Supabase, scripts, and root configuration files |
| Production dependency audit | Needs monitoring | 2 moderate React Router advisories; npm reports no fix available |
| Live Razorpay transaction | Not verified | Requires dashboard credentials and a real/test transaction |
| Deployed Supabase migrations/functions | Not verified | Requires access to the production Supabase project |
| Vercel production-domain behavior | Not verified | Requires the deployed production URL |

## Launch blockers

### 1. Legal pages require business/legal approval

The repository now contains working Terms, Privacy, and Refund Policy routes, and `/privacy` redirects to the canonical `/privacy-policy` route. The business must review and approve the wording before launch; repository implementation is not legal advice.

Before launch:

- Confirm the Terms and Conditions, Privacy Policy, and Refund/Cancellation Policy match actual business practices.
- Include business identity, contact details, course-access/delivery terms, refund timelines, data use, retention, and grievance/support information.
- Obtain jurisdiction-appropriate legal review.

### 2. Production dependency advisories

Moving `shadcn` and `dotenv` to development dependencies reduced the production audit from 17 advisories to 2 moderate React Router advisories. `npm audit` currently reports no patched version for those remaining advisories.

Before launch:

- Monitor React Router releases/advisories and update when a patched compatible release becomes available.
- Rerun `npm audit --omit=dev`, the production build, and all tests.
- Do not run a blind `npm audit fix --force`; review breaking changes.

### 3. Production payment path requires live verification

The server correctly calculates prices, validates the logged-in user, verifies Razorpay signatures, validates captured amount/currency/order, rate-limits order creation, and processes `payment.captured` webhooks. Automated payment security checks pass. However, the deployed secrets, webhook, capture behavior, enrollment, EMI behavior, and receipt delivery have not been tested against the production dashboards.

Before launch, complete one controlled end-to-end transaction and confirm:

- Razorpay order amount equals the server-side course price.
- Successful payment creates or updates exactly one enrollment.
- Closing the checkout tab still completes enrollment through the webhook.
- Duplicate webhook delivery is idempotent.
- Failed/cancelled payments do not grant access.
- EMI registration and subsequent installment amounts are correct.
- The receipt arrives and contains the correct student, course, amount, IDs, and date.
- Refund/support procedures work operationally.

### 4. Production authentication configuration requires verification

The code contains `/auth/callback` and `/reset-password`. Confirm the production domain is configured in Supabase Authentication URL Configuration and Google OAuth.

Test registration, email confirmation (if enabled), Google login, logout, forgotten password, password reset, expired links, blocked accounts, and role routing with separate student, teacher, and admin accounts.

## Important fixes

### Allura font reference resolved

The unused broken Allura `@font-face` rule was removed. The production build no longer reports the missing font.

### Font licensing

The repository contains a `Miracle` font whose included license forbids commercial/profit use without a paid license. It was not found referenced in application source and was not emitted in the reviewed build, but it should be removed from the repository or licensed before anyone uses it. Satoshi and Telma include commercial-use terms, subject to their restrictions.

### Production security headers

`vercel.json` now configures HSTS, nosniff, frame denial, strict-origin referrer policy, a restrictive permissions policy, and an OAuth-compatible opener policy. A Content Security Policy remains to be introduced only after testing the exact Razorpay, Supabase, and video resource requirements.

- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Permissions-Policy`
- A tested `Content-Security-Policy` that permits the required Supabase, Razorpay, Resend-independent browser resources, YouTube embeds, fonts, images, and scripts without unsafe broad allowances where avoidable

Roll out CSP in report-only mode first if necessary so payment and video flows are not accidentally blocked.

### Performance

The main JavaScript chunk is approximately 745 KB minified (about 226 KB gzip), and the build warns about chunks above 500 KB. Two images are approximately 1.5 MB and 2.4 MB. Optimize those images and continue route/component code-splitting, then test on a mid-range Android device over a throttled connection.

### Monitoring and recovery

No dedicated production error-monitoring integration was found. Before launch:

- Add frontend error monitoring and source maps with protected access.
- Configure Supabase Edge Function and database alerts.
- Enable Razorpay webhook failure alerts/retries.
- Keep Apps Script failure notifications enabled for the daily Google Sheets sync.
- Confirm Supabase backups and document a restore procedure.
- Prepare a support escalation procedure for charged-but-not-enrolled users.

## Where every key and setting belongs

### A. Local frontend development: `.env.local`

Only browser-safe values belong here:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

`VITE_API_URL` may remain absent/blank unless a separate API is actually introduced. Never put `sb_secret_`, service-role, Razorpay secret, webhook secret, or Resend key in any `VITE_*` variable.

### B. Vercel: Project Settings -> Environment Variables

Add these for Production (and Preview only if previews should use a safe non-production backend):

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Redeploy after changing Vite variables because they are embedded at build time. Do not add server secrets to the Vercel frontend project unless a future server-side Vercel function explicitly needs them.

### C. Supabase: Edge Functions -> Secrets

Store the payment/email server secrets here:

```text
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
APP_ORIGINS=https://your-production-domain.example
RESEND_API_KEY=re_...
PAYMENT_RECEIPT_FROM=Creative Adhyayan <receipts@your-verified-domain.example>
```

For multiple allowed origins, use a comma-separated `APP_ORIGINS` value with exact origins and no paths. Do not leave the production function on its localhost default.

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to hosted Edge Functions. Do not expose them to the browser. For local Edge Function development, place required server values in the local Supabase function environment file excluded from Git.

### D. Razorpay Dashboard

- Use live `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` only for production.
- Configure the webhook URL as:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/lms-payment-webhook
```

- Subscribe to `payment.captured`.
- Set a strong webhook secret and place the exact same value in Supabase as `RAZORPAY_WEBHOOK_SECRET`.
- Do not put the Razorpay key secret in Vercel frontend variables or source code. The public Razorpay key ID is returned to the authenticated client by the payment Edge Function.

### E. Resend Dashboard and Supabase

- Verify the sending domain in Resend and complete its DNS records.
- Create a Resend API key.
- Put `RESEND_API_KEY` and `PAYMENT_RECEIPT_FROM` in Supabase Edge Function secrets, not Vercel or `.env.local`.

### F. Supabase Authentication settings

In Authentication -> URL Configuration:

```text
Site URL: https://your-production-domain.example
Redirect URLs:
https://your-production-domain.example/auth/callback
https://your-production-domain.example/reset-password
```

Add localhost URLs only for local development. Configure the matching authorized JavaScript origins and redirect URI in the Google OAuth provider.

### G. Google Apps Script: Project Settings -> Script Properties

For the restricted administrator-only Sheets sync:

```text
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_... (or legacy service-role key)
LMS_SPREADSHEET_ID=managed automatically by the setup function
```

The spreadsheet and Apps Script project must remain restricted to trusted administrators because script editors can read Script Properties.

### H. One-time local course seeding only

`uploadCourses.mjs` expects server credentials locally:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
SEED_INSTRUCTOR_ID=...
```

Keep these in a Git-ignored local environment only. Never deploy `SUPABASE_SERVICE_ROLE_KEY` or `SEED_INSTRUCTOR_ID` as public Vite variables.

## Final acceptance test

Use separate accounts and record results for:

1. Anonymous catalog and public course details.
2. Student registration, Google login, password reset, and logout.
3. Teacher draft creation, editing, content upload, and publishing workflow.
4. Admin approval, role management, blocking, exports, and announcements.
5. Free enrollment and paid one-time enrollment.
6. EMI registration, installment payment, overdue access restriction, and completion.
7. Lesson access, video progress, assignments, attendance, and certificate issuance.
8. Private file access attempts from an unrelated account.
9. Payment cancellation, browser closure after payment, webhook retry, and duplicate delivery.
10. Receipt email, WhatsApp/support links, legal links, mobile layout, slow network, and accessibility keyboard flow.
11. Daily Google Sheets sync and failure notification.
12. Backup/restore rehearsal and incident contacts.

Launch only after every blocker is closed, the controlled live payment succeeds, and the deployed production domain passes the acceptance test.
