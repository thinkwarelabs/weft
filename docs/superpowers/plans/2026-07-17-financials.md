# Financials & Expenses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** A Financials dashboard (revenue by period with ex-GST/GST/total distribution, expenses, net) plus expense tracking, per the approved design discussion on 2026-07-17.

**Architecture:** Same patterns as the existing app: server-only Supabase access, zod validation, route handlers, client components fetching APIs, custom UI kit. Aggregation math is pure, unit-tested code in `src/lib/financials.ts`; the API returns raw rows, the client aggregates.

**Approved decisions:** Revenue = PAID invoices only, bucketed by `paid_at` (new column, set by mark-paid; fallback `updated_at` for rows paid before the migration). Amounts grouped by currency (no conversion). Expenses: name, type (free text), amount, currency, payer (company account or a named person), expense date, optional note. Net = revenue total − expenses, per currency. Quarters are calendar JFM/AMJ/JAS/OND; halves are Jan–Jun/Jul–Dec.

## Global Constraints

Same as the 2026-07-16 plan: TS strict, `npm run build` green per task, npm, custom UI only, plain commits without AI attribution, server-only secrets, money via `round2`.

---

### Task F1: Schema migration + types + financials math lib (TDD)

**Files:**
- Create: `supabase/002_financials.sql`
- Create: `src/lib/financials.ts`
- Test: `src/lib/financials.test.ts`
- Modify: `src/lib/types.ts` (add `Expense`, add `paid_at` to `Invoice`), `src/lib/validation.ts` (add `expenseInput`)

**Interfaces produced:**
- SQL: `expenses` table + `invoices.paid_at timestamptz null`
- `expenseInput` zod: `{ name: min1, expense_type: optionalText, amount: z.number().positive(), currency: z.string().length(3), payer_type: z.enum(['company','person']), payer_name: optionalText (refined: required when payer_type==='person'), expense_date: isoDate, note: optionalText }`
- `Expense` type mirroring the table (numerics may arrive as strings — consumers coerce).
- `src/lib/financials.ts`:
  - `type Granularity = 'month' | 'quarter' | 'half' | 'custom'`
  - `interface PeriodSel { granularity: Granularity; year: number; index: number; from?: string; to?: string }` (index: month 0-11, quarter 0-3, half 0-1; from/to used only for custom)
  - `periodRange(sel: PeriodSel): { from: string; to: string }` — inclusive ISO dates. Quarter 0 = Jan 1–Mar 31 (JFM). Half 0 = Jan 1–Jun 30.
  - `periodLabel(sel: PeriodSel): string` — "July 2026", "JFM 2026", "Jan–Jun 2026", "12 Jul 2026 – 31 Aug 2026"
  - `shiftPeriod(sel: PeriodSel, delta: -1 | 1): PeriodSel` — prev/next month/quarter/half with year rollover (no-op for custom)
  - `monthsInRange(from: string, to: string): { year: number; month: number; label: string }[]`
  - `interface RevenueRow { currency: string; subtotal: number; tax_amount: number; total: number; paidDate: string }` and `interface ExpenseRow { currency: string; amount: number; expense_date: string }`
  - `aggregate(revenue: RevenueRow[], expenses: ExpenseRow[]): CurrencyBucket[]` where `CurrencyBucket = { currency, exGst, gst, total, expenses, net }` — all via `round2`, net = total − expenses
  - `monthlyBreakdown(from, to, revenue, expenses): { label, buckets: CurrencyBucket[] }[]` — one row per month in range, bucketing rows by their date's year+month

**Test cases (TDD, write first):** quarter/half/month ranges incl. leap-Feb and Dec→Jan shifts; JFM label; aggregate mixing USD+INR rows; net negative when expenses exceed revenue; monthlyBreakdown buckets a paid invoice and expense into the right months; empty inputs → empty buckets.

**SQL content:**

```sql
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  expense_type text,
  amount numeric not null,
  currency text not null default 'USD',
  payer_type text not null default 'company' check (payer_type in ('company','person')),
  payer_name text,
  expense_date date not null,
  note text,
  created_at timestamptz not null default now()
);
alter table expenses enable row level security;
alter table invoices add column if not exists paid_at timestamptz;
```

USER CHECKPOINT (controller): paste `supabase/002_financials.sql` in the Supabase SQL Editor, then verify with a quick select.

Commit: `feat: add expenses schema and financials math lib`

---

### Task F2: Expenses + financials APIs, paid_at stamping

**Files:**
- Create: `src/app/api/expenses/route.ts` (GET all ordered by expense_date desc → `{ expenses }`; POST validated → 201 `{ expense }`)
- Create: `src/app/api/expenses/[id]/route.ts` (PATCH partial — use the present-keys filter pattern from `src/app/api/clients/[id]/route.ts` to avoid the zod `.default('')` wipe bug → `{ expense }`; DELETE → `{ ok: true }`)
- Create: `src/app/api/financials/route.ts` — GET `?from=YYYY-MM-DD&to=YYYY-MM-DD` (validate both, 400 if missing/malformed): fetch invoices `status='paid'` with `id, invoice_number, currency, subtotal, tax_amount, total, paid_at, updated_at, clients(name)`, filter in route code to `paidDate = (paid_at ?? updated_at)` date within [from, to] (compare the ISO date part); fetch expenses with `expense_date` in range via `.gte/.lte`. Return `{ invoices: [...rows plus computed paidDate], expenses }`.
- Modify: `src/app/api/invoices/[id]/mark-paid/route.ts` — also set `paid_at: new Date().toISOString()`.

Commit: `feat: add expenses and financials APIs, stamp paid_at`

---

### Task F3: Financials page UI + nav

**Files:**
- Create: `src/app/financials/page.tsx` (AppShell, h1 "Financials", subtitle "Revenue, GST and expenses by period.")
- Create: `src/components/financials/PeriodSelector.tsx` — props `{ sel: PeriodSel; onChange: (s: PeriodSel) => void }`: granularity pills (Monthly/Quarterly/Half-yearly/Custom, styling like existing tab pills); for non-custom: ‹ / label / › buttons using `shiftPeriod` + `periodLabel`; for custom: two date Inputs (from/to). Defaults handled by parent.
- Create: `src/components/financials/ExpenseFormModal.tsx` — props `{ open, onClose, initial?: Expense | null, onSaved: (e: Expense) => void }`, pattern-copy of ClientFormModal: fields Name (required, col-span-2), Type (free text + `datalist` of types already used — pass `knownTypes: string[]` prop), Amount (number, required), Currency (Select, CURRENCIES), Paid by (Select: Company account / Other person), Person name (Input, shown+required only when person), Expense date (date Input, default today), Note (Textarea col-span-2). POST/PATCH `/api/expenses`.
- Create: `src/components/financials/FinancialsDashboard.tsx` — client component:
  - State: `sel: PeriodSel` (default: current month), data `{ invoices, expenses } | null`, modal state, deleting state.
  - On sel change: compute `{from,to} = periodRange(sel)` (for custom, require both dates before fetching) → `GET /api/financials?from&to` → aggregate client-side with lib fns (coerce numerics with `Number()`).
  - Layout: PeriodSelector row (+ "Add expense" Button right); 5 summary Cards (Revenue ex-GST / GST collected / Total revenue / Expenses / Net) each listing per-currency values (one line per currency, `—` when empty; Net line red when negative, emerald when positive); monthly breakdown table (Month | Ex-GST | GST | Total | Expenses | Net; each cell multi-currency lines; hidden when range is a single month); "Paid invoices" table (Number → links to `/invoices/{id}`, Client, Paid on, Total) and "Expenses" table (Name, Type, Paid by — "Company account" or person name, Date, Amount, Edit/Delete actions; Delete via ConfirmDialog danger). EmptyStates per section.
  - Loading spinner: `min-h-[60vh] items-center justify-center`, `size-10` (match the rest of the app).
- Modify: `src/components/AppShell.tsx` — add "Financials" nav link (`/financials`) between Invoices and Clients.

Commit: `feat: add financials dashboard with period selector and expense tracking`

---

### Task F4: Verification

`npm run test` all green (including new financials lib tests), `npm run build` clean, controller runs a live seed→aggregate check plus visual pass, README gets a short "Financials" feature bullet. Commit: `docs: note financials feature in README`
