# Payments (TDS), Overdue Tracking & Void — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.

**Goal:** Three features approved 2026-07-17: (1) overdue visibility for finalized invoices past due date; (2) payment recording with TDS — one full settlement per invoice (user follows milestone invoicing; received + TDS must equal invoice total); (3) void/restore for finalized invoices (number stays burned).

**Working-tree caution (applies to every task):** the repo contains the user's own uncommitted WIP (email feature, UI polish). NEVER `git add -A` or `git add src/`. Stage only files you deliberately changed. If you must edit a user-modified file (e.g. `src/lib/pdf/InvoicePdf.tsx`), preserve their changes exactly and note the ride-along in your report.

## Global Constraints

Same as prior plans: TS strict, build+tests green per task, custom UI kit only (NOTE: `Select` has the new API `{value, onChange(value), options, placeholder?, disabled?}`), plain commits without AI attribution, money via `round2`, numerics from Supabase arrive as strings → `Number()` at read sites.

## Semantics (binding)

- **Overdue** is DERIVED, not a DB status: `status === 'finalized' && due_date < today`. Cancelled and paid invoices are never overdue.
- **Record payment** (replaces bare "Mark paid"): payment date (→ `paid_at` stored as `${date}T00:00:00.000Z`), amount received ≥ 0, TDS ≥ 0, optional reference (UTR); server enforces `round2(received + tds) === round2(total)`; sets status `paid`. Undo payment: paid → finalized, clears the four fields.
- **Void**: finalized → `cancelled` (409 otherwise). Restore: cancelled → finalized. Cancelled invoices keep their number, stay viewable/downloadable, are EXCLUDED from Outstanding sums and never appear in financials (financials already filters status='paid').
- **Financials**: Net stays `revenue total − expenses` (TDS is withheld tax you get credit for, not lost revenue). TDS is surfaced as its own card + table columns.

---

### Task G1: Schema + types + validation + overdue lib (TDD) + Badge

**Files:**
- Create: `supabase/003_payments_void.sql`, `src/lib/overdue.ts`, `src/lib/overdue.test.ts`
- Modify: `src/lib/types.ts`, `src/lib/validation.ts`, `src/components/ui/Badge.tsx`

**SQL (verbatim):**

```sql
alter table invoices add column if not exists amount_received numeric;
alter table invoices add column if not exists tds_amount numeric not null default 0;
alter table invoices add column if not exists payment_reference text;
alter table invoices drop constraint if exists invoices_status_check;
alter table invoices add constraint invoices_status_check
  check (status in ('draft','finalized','paid','cancelled'));
```

Do NOT apply it (controller handles the user checkpoint).

**Types:** `InvoiceStatus` += `'cancelled'`; `Invoice` += `amount_received: number | null`, `tds_amount: number`, `payment_reference: string | null`. `InvoiceListRow` += `due_date` already present — verify; add `tds_amount` NOT needed for list.

**Validation:** add `paymentInput = z.object({ payment_date: isoDate, amount_received: z.number().min(0), tds_amount: z.number().min(0).default(0), payment_reference: optionalText })` (+ export type).

**`src/lib/overdue.ts` (TDD):**
- `isOverdue(status: InvoiceStatus, dueDate: string, today?: string): boolean` — true only for finalized with dueDate < today (string compare of YYYY-MM-DD; `today` defaults to `todayISO()`).
- `daysOverdue(dueDate: string, today?: string): number` — whole days, pure date math (no TZ traps — reuse the `new Date(y, m, d)` local-construction approach from financials.ts).
Tests: finalized+past → true with correct day count (incl. month/year boundary), due today → false, future → false, paid/cancelled/draft past-due → false, defaulted `today`.

**Badge:** accept `status: InvoiceStatus | 'overdue'` and optional `label?: string` override. Styles: cancelled `bg-zinc-100 text-zinc-500 border-zinc-200` label "Cancelled"; overdue `bg-red-50 text-red-700 border-red-200` label "Overdue".

Verify `npm run test` + build. Commit (only these files): `feat: add payment fields, cancelled status, overdue lib`

---

### Task G2: API routes

**Files:**
- Modify: `src/app/api/invoices/[id]/mark-paid/route.ts` — validate body with `paymentInput` (400 + issues on invalid); 409 unless finalized; 400 `"Received + TDS must equal the invoice total"` unless `round2(amount_received + tds_amount) === round2(Number(invoice.total))`; update `{ status: 'paid', paid_at: payment_date + 'T00:00:00.000Z', amount_received, tds_amount, payment_reference: payment_reference || null, updated_at }` → `{ invoice }`.
- Create: `src/app/api/invoices/[id]/unmark-paid/route.ts` — POST, 409 unless paid → `{ status: 'finalized', paid_at: null, amount_received: null, tds_amount: 0, payment_reference: null, updated_at }` → `{ invoice }`.
- Create: `src/app/api/invoices/[id]/void/route.ts` — POST, 409 unless finalized → status `cancelled` → `{ invoice }`.
- Create: `src/app/api/invoices/[id]/unvoid/route.ts` — POST, 409 unless cancelled → status `finalized` → `{ invoice }`.
- Modify: `src/app/api/financials/route.ts` — add `amount_received, tds_amount` to the invoices select (everything else unchanged).

All follow existing conventions (`Ctx` params promise, existing-then-404, error.message 500s). Verify build + 401 curls on the new routes. Commit: `feat: add payment recording, undo, void and restore endpoints`

---

### Task G3: UI — dashboard, detail, financials, PDF status

**Files:**
- Create: `src/components/invoices/RecordPaymentModal.tsx` — props `{ invoice: { id: string; invoice_number: string | null; total: number; currency: string }; open; onClose; onSaved: (inv: Invoice) => void }`. Fields (ClientFormModal pattern): Payment date (default `todayISO()`), TDS amount (number, default "0"), Amount received (number, default = total; when the TDS field changes, auto-set received = `round2(total − tds)` unless the user has manually edited received since opening), Reference (optional, placeholder "UTR / transaction ref"). Live summary line: `formatMoney(received) + formatMoney(tds) TDS = formatMoney(total)`; client-side check `round2(received + tds) === round2(total)` with inline error "Received + TDS must equal {formatMoney(total)}". POST `/api/invoices/{id}/mark-paid` with `{ payment_date, amount_received, tds_amount, payment_reference }`; 400 issues → field errors; success → `onSaved(d.invoice)`, toast "Payment recorded".
- Modify: `src/components/invoices/InvoiceList.tsx`:
  - Tabs: All / Draft / Finalized / Overdue / Paid / Cancelled. Overdue tab filters `isOverdue(...)`; Finalized tab shows finalized NOT overdue? No — Finalized shows all finalized (incl. overdue); Overdue is a focused subset view.
  - Row badge: `isOverdue(...)` → `<Badge status="overdue" label={'Overdue · ' + daysOverdue(r.due_date) + 'd'} />` else `<Badge status={r.status} />`.
  - Sort: in All tab, overdue rows first (stable, then created_at desc as now).
  - Outstanding card: exclude cancelled (finalized only — already is); add a red sub-line `text-xs text-red-600 mt-1` "{sums} overdue" via `sumByCurrency(overdueRows)` when any.
  - Actions: finalized rows → "Record payment" (opens modal; on saved update row status locally) + PDF; cancelled rows → no mutate actions.
- Modify: `src/components/invoices/InvoiceDetail.tsx`:
  - finalized: buttons Record payment (primary, modal), Void (Button variant="danger" via ConfirmDialog: title "Void this invoice?", message "The number stays used. Voided invoices are excluded from outstanding amounts and financials.", confirm "Void invoice"), Edit is NOT shown (finalized), Download stays.
  - Header sub-line: when overdue append red `Overdue · Nd`.
  - paid: a compact payment summary under the header (`Received {fm(amount_received)} · TDS {fm(tds_amount)} · {formatDateLong(paid_at.slice(0,10))}` + `· Ref {payment_reference}` when set) + "Undo payment" (secondary, ConfirmDialog) → POST unmark-paid.
  - cancelled: badge renders Cancelled; "Restore invoice" (secondary, ConfirmDialog) → POST unvoid.
  - Remove the old bare "Mark paid" button.
- Modify: `src/components/financials/FinancialsDashboard.tsx` — sixth card "TDS deducted" (sum of `tds_amount` of period's paid invoices per currency via a small extra aggregate — reuse `sumByCurrency`-style helper locally with `RevenueRow`-like mapping); Paid-invoices table gains Received and TDS columns (`Number()` coerced, `formatMoney`).
- Modify: `src/lib/pdf/InvoicePdf.tsx` (USER-MODIFIED file — preserve their edits, add only:) `InvoicePdfData.cancelled?: boolean`; when true render an extra meta row `<View style={s.metaRow}><Text style={s.metaLabel}>Status</Text><Text style={{fontWeight: 700}}>CANCELLED</Text></View>`. And `src/app/api/invoices/[id]/pdf/route.ts` (ALSO user-modified) passes `cancelled: invoice.status === 'cancelled'`.

Verify build + tests + auth-gated curls. Stage ONLY the files above. Commit: `feat: overdue tracking, payment recording with tds, void and restore in ui`

---

### Task G4: Verification

Live DB check (controller): record-payment math + void flow against seeded rows; suite + build; ledger. No README changes (user is editing it).
