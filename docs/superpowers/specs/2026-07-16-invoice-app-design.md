# Invoice App — Design Spec

**Date:** 2026-07-16
**Status:** Approved by Sarthak

## Overview

Internal invoice tool for Thinkware Labs. Create invoices, browse/search past invoices, and generate PDFs on demand from structured data (no PDF files stored). Single Next.js repo containing frontend and backend. Access restricted to an env-configured allowlist of Google accounts.

## Stack

- **Next.js 15** (App Router, TypeScript) — frontend + API route handlers in one repo
- **Tailwind CSS** — fully custom-built premium UI components (no component library)
- **NextAuth (Auth.js v5)** — Google sign-in, JWT sessions, env-based email allowlist
- **Supabase (Postgres)** — accessed server-side only via the `sb_secret` key; browser never talks to Supabase directly, no RLS needed
- **@react-pdf/renderer** — server-side PDF generation from React template components

## Data model (Supabase)

### `business_profile` (single row, editable from Settings)
- Company name, address line 1/2, city, state, postal code, country, email, phone
- Tax/VAT/GST ID; optional legal note line (e.g. "Registered person liable for GST/VAT under reverse charge.")
- Bank details (all optional): account holder name, bank name, account number, IFSC, SWIFT
- Invoice number prefix (e.g. `TWL`) and next sequence number
- Default currency, default tax label, default tax rate

### `clients`
- Name, address line 1/2, city, state, postal code, country, email, phone, optional tax ID
- `archived` boolean (soft delete — never breaks old invoices)

### `invoices`
- `invoice_number` (unique, assigned at finalization, e.g. `TWL-0012`)
- `client_id` FK, issue date, due date
- `status`: `draft` | `finalized` | `paid`
- Currency, tax label, tax rate, optional payment link URL, optional notes
- Snapshot JSON columns (frozen at finalization): `business_snapshot`, `client_snapshot` — old PDFs always render as issued even if profile/client edited later
- Stored totals: subtotal, tax amount, total

### `invoice_items`
- `invoice_id` FK, description, optional period line (e.g. "Jul 10–Aug 9, 2026"), qty, unit price, amount, sort order

## Pages

All pages behind Google sign-in. Custom premium UI: custom buttons, inputs, tables, modals, toasts; thinkwarelabs logo; clean typographic style matching the invoice template.

1. **Sign-in** — logo + "Continue with Google". Non-allowlisted accounts see "This account isn't authorized."
2. **Dashboard / Invoices list** (home) — invoice table (number, client, issue date, total, status badge), search by number/client, filter by status. Row actions: View PDF, Edit (drafts), Mark paid, Delete (drafts only). Summary cards: total outstanding, total paid this month, invoice count.
3. **Create/Edit invoice** — client picker (searchable + inline "add new client"), issue/due dates, currency, tax label + rate, line items editor with live-computed amounts and totals panel, optional payment link and notes. Actions: "Save draft", "Finalize & generate PDF".
4. **Invoice detail / PDF view** — in-app PDF preview + Download button; status actions (Mark paid; Edit if draft). New finalizations auto-download once.
5. **Settings** — Business profile section (company details, tax IDs, bank details, invoice prefix, defaults) + Clients section (list, add, edit, archive).

## API (Next.js route handlers)

- `GET/POST /api/clients`; `PATCH/DELETE /api/clients/:id`
- `GET/POST /api/invoices`; `GET/PATCH/DELETE /api/invoices/:id` (drafts editable; finalized locked)
- `POST /api/invoices/:id/finalize` — atomically assigns next invoice number, snapshots business profile + client into the invoice, sets `finalized`
- `POST /api/invoices/:id/mark-paid`
- `GET /api/invoices/:id/pdf` — loads structured data, renders PDF with @react-pdf/renderer, streams it back. Never stored on disk. Filename `Invoice-<number>.pdf`.
- `GET/PATCH /api/settings`

## PDF template

Reproduces the provided Vercel-style invoice layout:
- Header: "Invoice" title left, thinkwarelabs logo top-right
- Meta block: invoice number, date of issue, date due
- Two columns: issuer (business profile snapshot) | "Bill to" (client snapshot)
- Amount-due banner: "$X USD due <date>"
- Optional "Pay online" link (only if payment link set)
- Tax ID + legal note lines
- Items table: Description (+ period line), Qty, Unit price, Tax, Amount
- Totals stack: Subtotal → Total excluding tax → tax line ("<label> (<rate>% on <subtotal>)") → Total → Amount due
- Payment details block: bank details from business profile (only fields that are filled)

## Auth

- NextAuth v5, Google provider, JWT sessions
- `signIn` callback: reject emails not in `ALLOWED_EMAILS` (comma-separated, case-insensitive)
- Middleware protects all pages and all `/api/*` routes

## Environment variables

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, `ALLOWED_EMAILS`. `.env.local` is gitignored.

## Error handling

- zod validation client + server; inline form errors
- API failures → toast notifications
- PDF route → clear error response if invoice missing

## Testing / verification

End-to-end manual verification by running the app: sign-in gate (allowed + rejected account), create client, create + finalize invoice, PDF matches template layout, auto-download on finalize, mark paid, edit business profile reflected in new PDFs but not old (snapshot check).

## Out of scope (YAGNI)

- Emailing invoices to clients
- Multi-currency conversion / exchange rates
- Payment gateway integration (only an optional link field)
- Storing generated PDFs
- Roles/permissions beyond the allowlist
