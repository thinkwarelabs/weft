# Thinkware Labs Invoice App
   
An internal invoicing tool for Thinkware Labs. Built with Next.js 16, this full-stack application manages invoice drafting, finalization, and PDF generation. Sign-ins are restricted to an allowlist of company email addresses, invoices are stored as structured data in Supabase, and PDFs are generated on demand from that data using @react-pdf/renderer, matching the company invoice template.

## Stack

Next.js 16 (App Router, TypeScript), Tailwind CSS v4, NextAuth v5 (Google), Supabase (Postgres), @react-pdf/renderer, vitest.

## Prerequisites

- Node.js 20+
- npm
- A Supabase project
- A Google Cloud OAuth client

## Environment Variables

Set the following in `.env.local` (gitignored):

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable API key — currently unused — reserved for future client-side access | Supabase → Settings → API → Project API keys (public key) |
| `SUPABASE_SECRET_KEY` | Supabase secret API key | Supabase → Settings → API → Project API keys (secret key, starts with `sb_secret_`) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Google Cloud Console → Credentials → OAuth client |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Google Cloud Console → Credentials → OAuth client |
| `AUTH_SECRET` | NextAuth session secret | Generate with `openssl rand -base64 32` |
| `ALLOWED_EMAILS` | Comma-separated list of Gmail addresses allowed to sign in | Configure as needed |
| `AUDIT_ADMINS` | Comma-separated emails allowed to view the Audit log page (a subset of `ALLOWED_EMAILS`) | Configure as needed |
| `HEALTHCHECK_KEY` | Shared secret for the public keep-alive endpoint (`GET /api/health?key=…`) | Generate with `openssl rand -hex 24` |
| `EMAIL_HOST` | SMTP host for invoice notifications | e.g. `smtp.gmail.com` |
| `EMAIL_PORT` | SMTP port | `587` for STARTTLS, `465` for implicit TLS |
| `EMAIL_SECURE` | `true` for implicit TLS (port 465), `false` for STARTTLS (port 587) | Match your port |
| `EMAIL_USER` | SMTP username | For Gmail, the full address |
| `EMAIL_PASSWORD` | SMTP password | For Gmail, an App Password (Google Account → Security → App passwords) |
| `EMAIL_FROM` | From header, e.g. `Thinkware Invoice <you@example.com>` | Defaults to `EMAIL_USER` if unset |
| `EMAIL_TO` | Comma-separated recipients notified when an invoice is finalized | Configure as needed |
| `EMAIL_CC` | Comma-separated CC recipients (optional) | Configure as needed |

For Google OAuth, set the redirect URI to `http://localhost:3000/api/auth/callback/google` in the Google Cloud Console.

When an invoice is finalized, an email with the invoice details, the generating user, and the PDF attached is sent to `EMAIL_TO`/`EMAIL_CC`. If the `EMAIL_*` variables are not set, the notification is skipped (finalization still works); an email failure never blocks finalization.

## Database Setup

1. Copy the contents of `supabase/schema.sql`.
2. Open your Supabase project and go to the SQL Editor.
3. Paste and run the schema to create all tables and functions.
4. Run the incremental migrations in order: `002_financials.sql`, `003_payments_void.sql`, `004_gst_inclusive_items.sql`, `005_audit_logs.sql`.
5. Verify the setup with `node scripts/check-db.mjs`.

## Commands

```bash
npm run dev       # Start development server (http://localhost:3000)
npm run build     # Build for production
npm run test      # Run vitest suite
npm run lint      # Run ESLint
```

## How It Works

- **Invoice Drafting**: Create invoices with client details, line items, and totals. Drafts are saved to Supabase.
- **Finalization**: Mark an invoice as finalized to assign it a TWL-#### number and snapshot the business and client details at that moment. Old PDFs never change even if settings are updated later.
- **PDF Generation**: The `/api/invoices/:id/pdf` endpoint regenerates the PDF from stored data every time it is requested. PDFs are never stored as files.
- **Payment Tracking**: Mark finalized invoices as paid.
- **Business Profile**: Edit your company name, address, bank details, and other information in Settings. These details are printed on the invoice PDF.
- **Client Management**: Manage client details (name, email, address) in Settings.
- **Audit Log**: Every write action (invoice, client, expense, and settings changes) is recorded to the `audit_logs` table with the acting user's email, the action, the affected record, and a timestamp. Users listed in `AUDIT_ADMINS` can browse the trail at `/audit` — a paginated, filterable table served with server-side (API-route) pagination.
- **Keep-alive**: `GET /api/health?key=<HEALTHCHECK_KEY>` is a public endpoint that pings the database to keep a free-tier Supabase project from pausing. Point an uptime monitor (e.g. UptimeRobot) at it on a schedule. It only queries the database when the correct `key` is supplied; without it (or with a wrong key) it does nothing and still returns `{ "success": true }`.

## Deploying

1. Add your production URL to the Google Cloud Console OAuth client (Authorized origins and Redirect URIs).
2. Set all environment variables on your hosting platform.
3. Deploy as a standard Next.js application.
