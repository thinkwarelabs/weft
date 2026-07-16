# Invoice App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Internal invoice tool for Thinkware Labs — create/browse invoices stored as structured data in Supabase, generate template-matching PDFs on demand, behind a Google-allowlist sign-in.

**Architecture:** Single Next.js 15 App Router app (frontend + API route handlers). All Supabase access is server-side via the secret key (no RLS policies needed; RLS is enabled with no policies to block anon access). NextAuth v5 middleware gates every page and API route. PDFs are rendered server-side from stored data with @react-pdf/renderer and never persisted.

**Tech Stack:** Next.js 15 (TypeScript, App Router, src dir, `@/*` alias), Tailwind CSS v4, NextAuth v5 (`next-auth@beta`) with Google provider, `@supabase/supabase-js`, `zod`, `@react-pdf/renderer`, `vitest` for unit tests.

**Spec:** `docs/superpowers/specs/2026-07-16-invoice-app-design.md`

## Global Constraints

- TypeScript strict mode; `npm run build` must pass at the end of every task.
- NO UI component libraries (no shadcn, Radix, MUI, HeadlessUI). All UI components are custom-built per Task 5.
- Package manager: npm.
- Secrets are server-only env vars — never add `NEXT_PUBLIC_` prefix to `SUPABASE_SECRET_KEY`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, `ALLOWED_EMAILS`. `.env.local` is gitignored and must never be committed.
- All DB access goes through `src/lib/supabase.ts` (server-only). The browser never talks to Supabase.
- Commit messages: plain, conventional style (`feat: ...`), NO AI attribution / Co-Authored-By trailers (user preference).
- Currency amounts are `number` in JS, rounded to 2 decimals via `round2()` from `src/lib/money.ts` — never raw floating-point arithmetic stored unrounded.
- The env file already exists at `.env.local` with: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, `ALLOWED_EMAILS`. Do not rename these.

## Design language (applies to all UI tasks)

- Font: Inter (via `next/font/google`) everywhere.
- Palette: page bg `stone-50` (#FAFAF9), surfaces white, text `zinc-900`, muted text `zinc-500`, borders `zinc-200`, primary actions solid `zinc-900` (black) buttons. Status colors: draft = zinc, finalized = blue, paid = emerald.
- Shape: `rounded-lg`/`rounded-xl`, subtle shadows (`shadow-sm` on cards), 1px borders. Generous whitespace. No gradients.
- Every interactive element has hover + focus-visible states and `transition-colors`.
- The look should echo the invoice PDF itself: clean, typographic, monochrome with restrained accents.

---

### Task 1: Scaffold Next.js app + tooling

**Files:**
- Create: entire Next.js scaffold at repo root (`package.json`, `src/app/*`, `next.config.ts`, `tsconfig.json`, ...)
- Create: `vitest.config.ts`
- Create: `public/logo.png` (copy of `thinkwarelabs_logo.png`)
- Create: `src/lib/pdf/fonts/Inter_400Regular.ttf`, `Inter_500Medium.ttf`, `Inter_600SemiBold.ttf`, `Inter_700Bold.ttf`
- Modify: `src/app/globals.css`, `src/app/layout.tsx`

**Interfaces:**
- Produces: working `npm run dev` / `npm run build` / `npm run test`; Inter UI font wired; logo at `/logo.png`; PDF fonts on disk for Task 9.

- [ ] **Step 1: Scaffold with create-next-app into a temp dir, then move to repo root**

The repo root is non-empty (docs, pdf, logo, .env.local), so scaffold in a temp subdir with `--skip-install` and move the files up:

```bash
cd "/c/Users/Sarthak/My_work/thinkwarelabs/Internal Projects/invoice"
npx create-next-app@latest scaffold-tmp --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack --use-npm --skip-install --yes
rm scaffold-tmp/README.md            # keep repo root files
mv scaffold-tmp/.gitignore scaffold-tmp/gitignore-gen
cp -r scaffold-tmp/. .
rm -rf scaffold-tmp gitignore-gen
```

Keep the existing `.gitignore` (it already covers node_modules, .next, .env*). Verify `package.json`, `src/app/page.tsx`, `tsconfig.json` now exist at root.

- [ ] **Step 2: Install dependencies**

```bash
npm install
npm install next-auth@beta @supabase/supabase-js zod @react-pdf/renderer server-only
npm install -D vitest
```

If `@react-pdf/renderer` complains about React 19 peers, retry that one package with `--legacy-peer-deps` (v4.x supports React 19; the warning is safe).

- [ ] **Step 3: Add vitest config and test script**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { include: ['src/**/*.test.{ts,tsx}'] },
})
```

In `package.json` scripts add: `"test": "vitest run"`.

- [ ] **Step 4: Copy logo and download Inter TTFs for the PDF renderer**

```bash
cp thinkwarelabs_logo.png public/logo.png
mkdir -p src/lib/pdf/fonts
cd src/lib/pdf/fonts
curl -fLo Inter_400Regular.ttf  https://cdn.jsdelivr.net/npm/@expo-google-fonts/inter@0.2.3/Inter_400Regular.ttf
curl -fLo Inter_500Medium.ttf   https://cdn.jsdelivr.net/npm/@expo-google-fonts/inter@0.2.3/Inter_500Medium.ttf
curl -fLo Inter_600SemiBold.ttf https://cdn.jsdelivr.net/npm/@expo-google-fonts/inter@0.2.3/Inter_600SemiBold.ttf
curl -fLo Inter_700Bold.ttf     https://cdn.jsdelivr.net/npm/@expo-google-fonts/inter@0.2.3/Inter_700Bold.ttf
ls -la   # each file must be > 100 KB
```

Fallback if jsDelivr 404s: `https://rsms.me/inter/font-files/Inter-Regular.otf` (+ `Inter-Medium.otf`, `Inter-SemiBold.otf`, `Inter-Bold.otf`) — keep the same target filenames (react-pdf/fontkit reads OTF fine; the extension mismatch is harmless).

- [ ] **Step 5: Set up global styles and root layout**

Replace `src/app/globals.css` with:

```css
@import "tailwindcss";

@theme inline {
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
}

body {
  background-color: var(--color-stone-50);
  color: var(--color-zinc-900);
  -webkit-font-smoothing: antialiased;
}
```

Replace `src/app/layout.tsx` with:

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Thinkwarelabs Invoice',
  description: 'Internal invoicing tool for Thinkware Labs',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  )
}
```

- [ ] **Step 6: Verify build passes**

Run: `npm run build`
Expected: build completes with no type errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js app with Tailwind, vitest, fonts and logo"
```

---

### Task 2: Supabase schema

**Files:**
- Create: `supabase/schema.sql`
- Create: `scripts/check-db.mjs`

**Interfaces:**
- Produces: tables `business_profile` (single row id=1), `clients`, `invoices`, `invoice_items`; Postgres function `allocate_invoice_number() returns text` used by Task 8's finalize route.

- [ ] **Step 1: Write the schema SQL**

Create `supabase/schema.sql`:

```sql
create table if not exists business_profile (
  id int primary key check (id = 1),
  company_name text not null default 'Thinkware Labs',
  address_line1 text, address_line2 text,
  city text, state text, postal_code text, country text,
  email text, phone text,
  tax_id text, legal_note text,
  bank_account_name text, bank_name text, bank_account_number text,
  bank_ifsc text, bank_swift text,
  invoice_prefix text not null default 'TWL',
  next_invoice_number int not null default 1,
  default_currency text not null default 'USD',
  default_tax_label text default 'IGST - INDIA',
  default_tax_rate numeric not null default 18,
  updated_at timestamptz not null default now()
);

insert into business_profile (id) values (1) on conflict do nothing;

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address_line1 text, address_line2 text,
  city text, state text, postal_code text, country text,
  email text, phone text, tax_id text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique,
  client_id uuid not null references clients(id),
  issue_date date not null,
  due_date date not null,
  status text not null default 'draft' check (status in ('draft','finalized','paid')),
  currency text not null default 'USD',
  tax_label text,
  tax_rate numeric not null default 0,
  payment_link text,
  notes text,
  business_snapshot jsonb,
  client_snapshot jsonb,
  subtotal numeric not null default 0,
  tax_amount numeric not null default 0,
  total numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  description text not null,
  period text,
  qty numeric not null default 1,
  unit_price numeric not null default 0,
  amount numeric not null default 0,
  sort_order int not null default 0
);

-- Atomically claim the next invoice number, e.g. 'TWL-0012'
create or replace function allocate_invoice_number()
returns text language plpgsql as $$
declare pref text; seq int;
begin
  update business_profile
     set next_invoice_number = next_invoice_number + 1, updated_at = now()
   where id = 1
   returning invoice_prefix, next_invoice_number - 1 into pref, seq;
  return pref || '-' || lpad(seq::text, 4, '0');
end $$;

-- Block anon/publishable-key access entirely; the app uses the secret key which bypasses RLS.
alter table business_profile enable row level security;
alter table clients enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
```

- [ ] **Step 2: USER CHECKPOINT — apply the schema**

Ask the user to open the Supabase dashboard → SQL Editor → paste the full contents of `supabase/schema.sql` → Run. Wait for confirmation before continuing.

- [ ] **Step 3: Write the DB verification script**

Create `scripts/check-db.mjs`:

```js
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY)

for (const t of ['business_profile', 'clients', 'invoices', 'invoice_items']) {
  const { error } = await db.from(t).select('*', { head: true, count: 'exact' })
  if (error) { console.error(`FAIL ${t}: ${error.message}`); process.exit(1) }
  console.log(`OK table ${t}`)
}

const { data: num, error: rpcErr } = await db.rpc('allocate_invoice_number')
if (rpcErr) { console.error(`FAIL allocate_invoice_number: ${rpcErr.message}`); process.exit(1) }
console.log(`OK allocate_invoice_number -> ${num}`)
// undo the sequence burn from the test call
const { error: resetErr } = await db.from('business_profile').update({ next_invoice_number: 1 }).eq('id', 1)
if (resetErr) { console.error(`FAIL reset: ${resetErr.message}`); process.exit(1) }
console.log('OK sequence reset to 1')
```

- [ ] **Step 4: Run verification**

Run: `node scripts/check-db.mjs`
Expected output: `OK table ...` for all four tables, `OK allocate_invoice_number -> TWL-0001`, `OK sequence reset to 1`.

- [ ] **Step 5: Commit**

```bash
git add supabase/ scripts/
git commit -m "feat: add supabase schema and db check script"
```

---

### Task 3: Core libs — types, money math, allowlist, validation (TDD)

**Files:**
- Create: `src/lib/types.ts`, `src/lib/money.ts`, `src/lib/allowlist.ts`, `src/lib/validation.ts`, `src/lib/supabase.ts`, `src/lib/cn.ts`, `src/lib/dates.ts`
- Test: `src/lib/money.test.ts`, `src/lib/allowlist.test.ts`, `src/lib/validation.test.ts`, `src/lib/dates.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `InvoiceStatus`, `BusinessProfile`, `Client`, `Invoice`, `InvoiceItem`, `InvoiceInput`, `InvoiceItemInput`, `ClientInput`, `SettingsInput`
  - `money.ts`: `round2(n: number): number`, `lineAmount(qty: number, unitPrice: number): number`, `computeTotals(items: {qty: number; unit_price: number}[], taxRate: number): {subtotal: number; taxAmount: number; total: number}`, `formatMoney(amount: number, currency: string): string`
  - `allowlist.ts`: `isAllowedEmail(email: string | null | undefined, allowlist?: string): boolean`
  - `validation.ts`: zod schemas `clientInput`, `invoiceItemInput`, `invoiceInput`, `settingsInput` (+ inferred types re-exported from types.ts)
  - `supabase.ts`: `db` — server-only Supabase client
  - `dates.ts`: `formatDateLong(iso: string): string` ("2026-07-10" → "July 10, 2026"), `todayISO(): string`
  - `cn.ts`: `cn(...parts: Array<string | false | null | undefined>): string`

- [ ] **Step 1: Write failing tests for money math**

Create `src/lib/money.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { computeTotals, formatMoney, lineAmount, round2 } from './money'

describe('round2', () => {
  it('rounds to 2 decimals', () => {
    expect(round2(3.605)).toBe(3.61)
    expect(round2(0.1 + 0.2)).toBe(0.3)
  })
})

describe('lineAmount', () => {
  it('multiplies qty by unit price and rounds', () => {
    expect(lineAmount(1, 20)).toBe(20)
    expect(lineAmount(3, 33.335)).toBe(100.01)
  })
})

describe('computeTotals', () => {
  it('matches the template invoice: 1 x $20 at 18% -> 20 / 3.6 / 23.6', () => {
    const t = computeTotals([{ qty: 1, unit_price: 20 }], 18)
    expect(t).toEqual({ subtotal: 20, taxAmount: 3.6, total: 23.6 })
  })
  it('sums multiple rounded lines and handles 0% tax', () => {
    const t = computeTotals([{ qty: 2, unit_price: 10.005 }, { qty: 1, unit_price: 5 }], 0)
    expect(t).toEqual({ subtotal: 25.01, taxAmount: 0, total: 25.01 })
  })
})

describe('formatMoney', () => {
  it('formats USD and INR', () => {
    expect(formatMoney(23.6, 'USD')).toBe('$23.60')
    expect(formatMoney(1500, 'INR')).toBe('₹1,500.00')
  })
})
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/lib/money.test.ts`
Expected: FAIL — cannot resolve `./money`.

- [ ] **Step 3: Implement `src/lib/money.ts`**

```ts
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function lineAmount(qty: number, unitPrice: number): number {
  return round2(qty * unitPrice)
}

export interface Totals {
  subtotal: number
  taxAmount: number
  total: number
}

export function computeTotals(
  items: { qty: number; unit_price: number }[],
  taxRate: number
): Totals {
  const subtotal = round2(items.reduce((sum, i) => sum + lineAmount(i.qty, i.unit_price), 0))
  const taxAmount = round2(subtotal * (taxRate / 100))
  return { subtotal, taxAmount, total: round2(subtotal + taxAmount) }
}

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(amount)
}
```

- [ ] **Step 4: Write failing tests for allowlist and dates**

Create `src/lib/allowlist.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isAllowedEmail } from './allowlist'

const LIST = 'a@gmail.com, B@Gmail.com ,c@gmail.com'

describe('isAllowedEmail', () => {
  it('accepts listed emails case-insensitively, trimming spaces', () => {
    expect(isAllowedEmail('a@gmail.com', LIST)).toBe(true)
    expect(isAllowedEmail('b@gmail.com', LIST)).toBe(true)
    expect(isAllowedEmail('A@GMAIL.COM', LIST)).toBe(true)
  })
  it('rejects unlisted, empty and null emails', () => {
    expect(isAllowedEmail('evil@gmail.com', LIST)).toBe(false)
    expect(isAllowedEmail('', LIST)).toBe(false)
    expect(isAllowedEmail(null, LIST)).toBe(false)
    expect(isAllowedEmail('a@gmail.com', '')).toBe(false)
  })
})
```

Create `src/lib/dates.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatDateLong } from './dates'

describe('formatDateLong', () => {
  it('formats ISO dates like the template', () => {
    expect(formatDateLong('2026-07-10')).toBe('July 10, 2026')
    expect(formatDateLong('2026-01-01')).toBe('January 1, 2026')
  })
})
```

- [ ] **Step 5: Run tests, verify they fail**

Run: `npx vitest run src/lib/allowlist.test.ts src/lib/dates.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 6: Implement `src/lib/allowlist.ts`, `src/lib/dates.ts`, `src/lib/cn.ts`**

`src/lib/allowlist.ts`:

```ts
export function isAllowedEmail(
  email: string | null | undefined,
  allowlist: string = process.env.ALLOWED_EMAILS ?? ''
): boolean {
  if (!email) return false
  const allowed = allowlist
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return allowed.includes(email.trim().toLowerCase())
}
```

`src/lib/dates.ts`:

```ts
export function formatDateLong(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
```

`src/lib/cn.ts`:

```ts
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
```

- [ ] **Step 7: Write failing tests for validation schemas**

Create `src/lib/validation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { clientInput, invoiceInput, settingsInput } from './validation'

const validInvoice = {
  client_id: '2f9d2f7e-1111-4222-8333-444455556666',
  issue_date: '2026-07-10',
  due_date: '2026-07-10',
  currency: 'USD',
  tax_label: 'IGST - INDIA',
  tax_rate: 18,
  payment_link: '',
  notes: '',
  items: [{ description: 'Pro', period: 'Jul 10–Aug 9, 2026', qty: 1, unit_price: 20 }],
}

describe('invoiceInput', () => {
  it('accepts a valid invoice', () => {
    expect(invoiceInput.safeParse(validInvoice).success).toBe(true)
  })
  it('rejects empty items, bad dates, negative rates and bad links', () => {
    expect(invoiceInput.safeParse({ ...validInvoice, items: [] }).success).toBe(false)
    expect(invoiceInput.safeParse({ ...validInvoice, issue_date: '10-07-2026' }).success).toBe(false)
    expect(invoiceInput.safeParse({ ...validInvoice, tax_rate: -1 }).success).toBe(false)
    expect(invoiceInput.safeParse({ ...validInvoice, payment_link: 'not a url' }).success).toBe(false)
  })
})

describe('clientInput', () => {
  it('requires a name', () => {
    expect(clientInput.safeParse({ name: 'Vercel Inc.' }).success).toBe(true)
    expect(clientInput.safeParse({ name: '' }).success).toBe(false)
  })
})

describe('settingsInput', () => {
  it('validates prefix format and tax rate bounds', () => {
    expect(settingsInput.safeParse({ company_name: 'TWL', invoice_prefix: 'TWL', default_currency: 'USD', default_tax_rate: 18 }).success).toBe(true)
    expect(settingsInput.safeParse({ company_name: 'TWL', invoice_prefix: 'bad prefix!', default_currency: 'USD', default_tax_rate: 18 }).success).toBe(false)
    expect(settingsInput.safeParse({ company_name: 'TWL', invoice_prefix: 'TWL', default_currency: 'USD', default_tax_rate: 101 }).success).toBe(false)
  })
})
```

- [ ] **Step 8: Run tests, verify they fail**

Run: `npx vitest run src/lib/validation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 9: Implement `src/lib/validation.ts`**

```ts
import { z } from 'zod'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
const optionalText = z.string().trim().optional().default('')

export const clientInput = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  address_line1: optionalText,
  address_line2: optionalText,
  city: optionalText,
  state: optionalText,
  postal_code: optionalText,
  country: optionalText,
  email: z.string().trim().email().optional().or(z.literal('')).default(''),
  phone: optionalText,
  tax_id: optionalText,
})

export const invoiceItemInput = z.object({
  description: z.string().trim().min(1, 'Description is required'),
  period: optionalText,
  qty: z.number().positive('Qty must be > 0'),
  unit_price: z.number().min(0, 'Price must be >= 0'),
})

export const invoiceInput = z.object({
  client_id: z.string().uuid('Pick a client'),
  issue_date: isoDate,
  due_date: isoDate,
  currency: z.string().length(3),
  tax_label: optionalText,
  tax_rate: z.number().min(0).max(100),
  payment_link: z.string().trim().url().optional().or(z.literal('')).default(''),
  notes: optionalText,
  items: z.array(invoiceItemInput).min(1, 'Add at least one item'),
})

export const settingsInput = z.object({
  company_name: z.string().trim().min(1, 'Company name is required'),
  address_line1: optionalText,
  address_line2: optionalText,
  city: optionalText,
  state: optionalText,
  postal_code: optionalText,
  country: optionalText,
  email: z.string().trim().email().optional().or(z.literal('')).default(''),
  phone: optionalText,
  tax_id: optionalText,
  legal_note: optionalText,
  bank_account_name: optionalText,
  bank_name: optionalText,
  bank_account_number: optionalText,
  bank_ifsc: optionalText,
  bank_swift: optionalText,
  invoice_prefix: z.string().trim().regex(/^[A-Za-z0-9]{1,8}$/, '1-8 letters/digits').transform((s) => s.toUpperCase()),
  default_currency: z.string().length(3),
  default_tax_label: optionalText,
  default_tax_rate: z.number().min(0).max(100),
})

export type ClientInput = z.infer<typeof clientInput>
export type InvoiceItemInput = z.infer<typeof invoiceItemInput>
export type InvoiceInput = z.infer<typeof invoiceInput>
export type SettingsInput = z.infer<typeof settingsInput>
```

- [ ] **Step 10: Implement `src/lib/types.ts` and `src/lib/supabase.ts`**

`src/lib/types.ts`:

```ts
export type InvoiceStatus = 'draft' | 'finalized' | 'paid'

export interface BusinessProfile {
  id: number
  company_name: string
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  email: string | null
  phone: string | null
  tax_id: string | null
  legal_note: string | null
  bank_account_name: string | null
  bank_name: string | null
  bank_account_number: string | null
  bank_ifsc: string | null
  bank_swift: string | null
  invoice_prefix: string
  next_invoice_number: number
  default_currency: string
  default_tax_label: string | null
  default_tax_rate: number
}

export interface Client {
  id: string
  name: string
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  email: string | null
  phone: string | null
  tax_id: string | null
  archived: boolean
  created_at: string
}

export interface Invoice {
  id: string
  invoice_number: string | null
  client_id: string
  issue_date: string
  due_date: string
  status: InvoiceStatus
  currency: string
  tax_label: string | null
  tax_rate: number
  payment_link: string | null
  notes: string | null
  business_snapshot: BusinessProfile | null
  client_snapshot: Client | null
  subtotal: number
  tax_amount: number
  total: number
  created_at: string
  updated_at: string
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  description: string
  period: string | null
  qty: number
  unit_price: number
  amount: number
  sort_order: number
}

export interface InvoiceListRow {
  id: string
  invoice_number: string | null
  issue_date: string
  due_date: string
  status: InvoiceStatus
  currency: string
  total: number
  created_at: string
  clients: { name: string } | null
}

export type { ClientInput, InvoiceInput, InvoiceItemInput, SettingsInput } from './validation'
```

`src/lib/supabase.ts`:

```ts
import 'server-only'
import { createClient } from '@supabase/supabase-js'

export const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false } }
)
```

- [ ] **Step 11: Run all tests, verify they pass**

Run: `npm run test`
Expected: all test files PASS.

- [ ] **Step 12: Build and commit**

```bash
npm run build
git add src/ vitest.config.ts package.json package-lock.json
git commit -m "feat: add core libs - types, money math, allowlist, validation, supabase client"
```

---

### Task 4: Auth — NextAuth v5 Google sign-in with allowlist

**Files:**
- Create: `src/auth.ts`, `src/middleware.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/app/signin/page.tsx`

**Interfaces:**
- Consumes: `isAllowedEmail` from `@/lib/allowlist`
- Produces: `auth`, `signIn`, `signOut`, `handlers` exported from `@/auth`; every page except `/signin` and every `/api/*` except `/api/auth/*` requires a session (middleware). Later tasks assume routes/pages are already protected and do NOT re-check auth.

- [ ] **Step 1: Implement `src/auth.ts`**

```ts
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { isAllowedEmail } from '@/lib/allowlist'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/signin', error: '/signin' },
  callbacks: {
    signIn({ user }) {
      return isAllowedEmail(user.email)
    },
  },
})
```

(A rejected sign-in redirects to `/signin?error=AccessDenied` because `pages.error` is `/signin`.)

- [ ] **Step 2: Add the NextAuth route handler**

Create `src/app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from '@/auth'

export const { GET, POST } = handlers
```

- [ ] **Step 3: Implement `src/middleware.ts`**

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export default auth((req) => {
  if (req.auth?.user) return NextResponse.next()
  if (req.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.redirect(new URL('/signin', req.nextUrl.origin))
})

export const config = {
  matcher: ['/((?!api/auth|signin|_next/static|_next/image|favicon.ico|logo.png).*)'],
}
```

- [ ] **Step 4: Build the sign-in page**

Create `src/app/signin/page.tsx` (server component):

```tsx
import Image from 'next/image'
import { signIn } from '@/auth'

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <Image src="/logo.png" alt="Thinkware Labs" width={180} height={22} priority />
        <h1 className="mt-8 text-xl font-semibold tracking-tight">Sign in to Invoice</h1>
        <p className="mt-1 text-sm text-zinc-500">Internal tool — authorized accounts only.</p>
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            This Google account isn&apos;t authorized to use this app.
          </div>
        )}
        <form
          className="mt-6"
          action={async () => {
            'use server'
            await signIn('google', { redirectTo: '/' })
          }}
        >
          <button
            type="submit"
            className="flex h-10 w-full cursor-pointer items-center justify-center gap-3 rounded-lg border border-zinc-300 bg-white text-sm font-medium transition-colors hover:bg-zinc-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.17 3.57-8.81Z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3c-1.07.72-2.44 1.14-4.06 1.14-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A11.99 11.99 0 0 0 12 24Z" />
              <path fill="#FBBC05" d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.29a12 12 0 0 0 0 10.76l4-3.1Z" />
              <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.58 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0A11.99 11.99 0 0 0 1.29 6.62l4 3.1C6.23 6.88 8.88 4.77 12 4.77Z" />
            </svg>
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  )
}
```

- [ ] **Step 5: Manual verification**

1. Run `npm run dev`.
2. Open `http://localhost:3000/` → expect redirect to `/signin`.
3. `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/invoices` → expect `401`.
4. Sign in with an allowlisted Google account → expect redirect to `/` (default Next page for now).
5. In an incognito window, sign in with a non-allowlisted account → expect return to `/signin` with the "isn't authorized" error box.

- [ ] **Step 6: Build and commit**

```bash
npm run build
git add src/
git commit -m "feat: add Google sign-in with email allowlist and route protection"
```

---

### Task 5: Custom UI kit + app shell

**Files:**
- Create: `src/components/ui/Button.tsx`, `Input.tsx`, `Textarea.tsx`, `Select.tsx`, `Field.tsx`, `Badge.tsx`, `Card.tsx`, `Modal.tsx`, `ConfirmDialog.tsx`, `Toast.tsx`, `Spinner.tsx`, `EmptyState.tsx`
- Create: `src/components/AppShell.tsx`
- Modify: `src/app/layout.tsx` (wrap children in ToastProvider)

**Interfaces:**
- Consumes: `cn` from `@/lib/cn`, `auth`/`signOut` from `@/auth`
- Produces (exact props later tasks rely on):
  - `Button`: `{ variant?: 'primary'|'secondary'|'ghost'|'danger'; loading?: boolean } & ButtonHTMLAttributes`
  - `Input`, `Textarea`, `Select`: styled wrappers over native elements, forwarding all native props (`Select` renders `children` options)
  - `Field`: `{ label: string; error?: string; children: ReactNode; className?: string }`
  - `Badge`: `{ status: 'draft'|'finalized'|'paid' }`
  - `Card`: `{ title?: string; children; className? }`
  - `Modal`: `{ open: boolean; onClose: () => void; title: string; children; footer?: ReactNode }`
  - `ConfirmDialog`: `{ open: boolean; onClose: () => void; onConfirm: () => void|Promise<void>; title: string; message: string; confirmLabel?: string; danger?: boolean }`
  - `Toast.tsx`: exports `ToastProvider` and `useToast(): { toast: (msg: string, type?: 'success'|'error') => void }`
  - `EmptyState`: `{ title: string; hint?: string; action?: ReactNode }`
  - `AppShell`: server component `{ children }` — sidebar (logo, nav Invoices `/` + Settings `/settings`, signed-in email, Sign out) + scrollable main area

- [ ] **Step 1: Implement the primitives**

`src/components/ui/Spinner.tsx`:

```tsx
export function Spinner({ className = 'size-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
  )
}
```

`src/components/ui/Button.tsx`:

```tsx
'use client'
import { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-zinc-900 text-white hover:bg-zinc-700 disabled:bg-zinc-300',
  secondary: 'border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 disabled:text-zinc-400',
  ghost: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
  danger: 'bg-red-600 text-white hover:bg-red-500 disabled:bg-red-300',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
}

export function Button({ variant = 'primary', loading = false, className, children, disabled, ...rest }: Props) {
  return (
    <button
      className={cn(
        'inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed',
        variants[variant],
        className
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}
```

`src/components/ui/Input.tsx`:

```tsx
'use client'
import { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-zinc-900 focus:outline-none disabled:bg-zinc-50 disabled:text-zinc-400',
        className
      )}
      {...rest}
    />
  )
}
```

`src/components/ui/Textarea.tsx` — same classes with `h-9 px-3` replaced by `min-h-20 px-3 py-2`, element `<textarea>`.

`src/components/ui/Select.tsx`:

```tsx
'use client'
import { SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-9 w-full cursor-pointer appearance-none rounded-lg border border-zinc-300 bg-white bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27%2371717a%27 viewBox=%270 0 16 16%27%3E%3Cpath d=%27M4.646 6.146a.5.5 0 0 1 .708 0L8 8.793l2.646-2.647a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z%27/%3E%3C/svg%3E")] bg-[position:right_0.6rem_center] bg-no-repeat px-3 pr-8 text-sm transition-colors focus:border-zinc-900 focus:outline-none',
        className
      )}
      {...rest}
    >
      {children}
    </select>
  )
}
```

`src/components/ui/Field.tsx`:

```tsx
import { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Field({ label, error, children, className }: { label: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-zinc-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  )
}
```

`src/components/ui/Badge.tsx`:

```tsx
import { InvoiceStatus } from '@/lib/types'
import { cn } from '@/lib/cn'

const styles: Record<InvoiceStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  finalized: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const labels: Record<InvoiceStatus, string> = { draft: 'Draft', finalized: 'Finalized', paid: 'Paid' }

export function Badge({ status }: { status: InvoiceStatus }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', styles[status])}>
      {labels[status]}
    </span>
  )
}
```

`src/components/ui/Card.tsx`:

```tsx
import { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Card({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-zinc-200 bg-white p-6 shadow-sm', className)}>
      {title && <h2 className="mb-4 text-base font-semibold tracking-tight">{title}</h2>}
      {children}
    </section>
  )
}
```

`src/components/ui/Modal.tsx`:

```tsx
'use client'
import { ReactNode, useEffect } from 'react'

export function Modal({ open, onClose, title, children, footer }: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl border border-zinc-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
          <button onClick={onClose} className="cursor-pointer rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l10 10M13 3L3 13" /></svg>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-3 border-t border-zinc-100 px-6 py-4">{footer}</div>}
      </div>
    </div>
  )
}
```

`src/components/ui/ConfirmDialog.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false }: {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}) {
  const [busy, setBusy] = useState(false)
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            loading={busy}
            onClick={async () => {
              setBusy(true)
              try { await onConfirm() } finally { setBusy(false); onClose() }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-zinc-600">{message}</p>
    </Modal>
  )
}
```

`src/components/ui/Toast.tsx`:

```tsx
'use client'
import { ReactNode, createContext, useCallback, useContext, useState } from 'react'
import { cn } from '@/lib/cn'

type ToastType = 'success' | 'error'
interface ToastItem { id: number; msg: string; type: ToastType }

const ToastContext = createContext<{ toast: (msg: string, type?: ToastType) => void }>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const toast = useCallback((msg: string, type: ToastType = 'success') => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev, { id, msg, type }])
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg',
              t.type === 'success' ? 'border-zinc-200 bg-zinc-900 text-white' : 'border-red-200 bg-red-50 text-red-700'
            )}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
```

`src/components/ui/EmptyState.tsx`:

```tsx
import { ReactNode } from 'react'

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
      <p className="text-sm font-medium text-zinc-900">{title}</p>
      {hint && <p className="text-sm text-zinc-500">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
```

- [ ] **Step 2: Implement the app shell**

`src/components/AppShell.tsx` (server component):

```tsx
import Image from 'next/image'
import Link from 'next/link'
import { ReactNode } from 'react'
import { auth, signOut } from '@/auth'

export async function AppShell({ children }: { children: ReactNode }) {
  const session = await auth()
  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-zinc-200 bg-white">
        <div className="px-6 py-6">
          <Image src="/logo.png" alt="Thinkware Labs" width={150} height={18} priority />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          <Link href="/" className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900">
            Invoices
          </Link>
          <Link href="/settings" className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900">
            Settings
          </Link>
        </nav>
        <div className="border-t border-zinc-100 px-6 py-4">
          <p className="truncate text-xs text-zinc-500" title={session?.user?.email ?? ''}>{session?.user?.email}</p>
          <form
            action={async () => {
              'use server'
              await signOut({ redirectTo: '/signin' })
            }}
          >
            <button type="submit" className="mt-2 cursor-pointer text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-900">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="ml-60 flex-1 px-10 py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Wrap the root layout with ToastProvider**

In `src/app/layout.tsx`, import `ToastProvider` from `@/components/ui/Toast` and change the body to:

```tsx
<body className="font-sans">
  <ToastProvider>{children}</ToastProvider>
</body>
```

(AppShell is NOT applied here — the signin page must stay bare. Pages under the app apply it per-page or via a route group layout in Task 10.)

- [ ] **Step 4: Verify build + commit**

```bash
npm run build
git add src/
git commit -m "feat: add custom UI kit and app shell"
```

---

### Task 6: Settings API + Business profile page

**Files:**
- Create: `src/app/api/settings/route.ts`
- Create: `src/app/settings/page.tsx`, `src/components/settings/BusinessProfileForm.tsx`
- Create: `src/components/settings/ClientsManager.tsx` placeholder is NOT created here — Task 7 owns it; the settings page in this task renders only the profile form, Task 7 adds tabs.

**Interfaces:**
- Consumes: `db`, `settingsInput`, `BusinessProfile`, UI kit, `useToast`
- Produces: `GET /api/settings` → `{ profile: BusinessProfile }`; `PATCH /api/settings` body `SettingsInput` → `{ profile: BusinessProfile }` (400 on validation error). Task 8 (finalize) and Task 11 (form defaults) read the same `business_profile` row.

- [ ] **Step 1: Implement `src/app/api/settings/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase'
import { settingsInput } from '@/lib/validation'

export async function GET() {
  const { data, error } = await db.from('business_profile').select('*').eq('id', 1).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: data })
}

export async function PATCH(req: Request) {
  const body = await req.json()
  const parsed = settingsInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const { data, error } = await db
    .from('business_profile')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: data })
}
```

- [ ] **Step 2: Implement `src/components/settings/BusinessProfileForm.tsx`**

Client component. Behavior:
- On mount: `fetch('/api/settings')`, fill a `form` state object of strings/numbers (map `null` → `''`). Show a centered `Spinner` while loading.
- Renders `Card` sections in a single column, `max-w-3xl`:
  1. **Company** — `Field`s in a 2-col grid (`grid grid-cols-2 gap-4`; full-width rows use `col-span-2`): Company name (col-span-2), Address line 1 (col-span-2), Address line 2 (col-span-2), City, State, Postal code, Country, Email, Phone.
  2. **Tax** — Tax / VAT / GST ID, Legal note (Textarea, col-span-2, placeholder "e.g. Registered person liable for GST/VAT under reverse charge.").
  3. **Bank details** — Account holder name, Bank name, Account number, IFSC, SWIFT.
  4. **Invoicing defaults** — Invoice prefix, Default currency (`Select` with options USD, INR, EUR, GBP, AED, AUD, CAD, SGD), Default tax label, Default tax rate (`Input type="number" step="0.01"`).
- Sticky footer row with a `Button` "Save changes" (`loading` while submitting).
- Submit: coerce `default_tax_rate` with `Number(...)`, `PATCH /api/settings`; on 400 map `issues` into a `{[field]: string}` errors state shown via `Field error=`; on success `toast('Profile saved')`; on other failure `toast(msg, 'error')`.

Complete state/submit skeleton (the JSX fields follow the layout above using `Field`+`Input`):

```tsx
'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import { BusinessProfile } from '@/lib/types'

type FormState = Record<string, string>
const CURRENCIES = ['USD', 'INR', 'EUR', 'GBP', 'AED', 'AUD', 'CAD', 'SGD']

function toForm(p: BusinessProfile): FormState {
  const f: FormState = {}
  for (const [k, v] of Object.entries(p)) f[k] = v === null ? '' : String(v)
  return f
}

export function BusinessProfileForm() {
  const [form, setForm] = useState<FormState | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => setForm(toForm(d.profile)))
      .catch(() => toast('Failed to load profile', 'error'))
  }, [toast])

  if (!form) return <div className="flex justify-center py-20"><Spinner className="size-6 text-zinc-400" /></div>

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f!, [k]: e.target.value }))

  async function save() {
    setSaving(true)
    setErrors({})
    const payload = { ...form, default_tax_rate: Number(form!.default_tax_rate || 0) }
    delete (payload as Record<string, unknown>).id
    delete (payload as Record<string, unknown>).next_invoice_number
    delete (payload as Record<string, unknown>).updated_at
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) { toast('Profile saved') }
    else {
      const d = await res.json().catch(() => ({}))
      if (d.issues) setErrors(Object.fromEntries(Object.entries(d.issues).map(([k, v]) => [k, (v as string[])[0]])))
      toast(d.error ?? 'Failed to save', 'error')
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {/* Card: Company / Tax / Bank details / Invoicing defaults — fields per layout spec */}
      {/* ... Field + Input/Select/Textarea rows bound with value={form.x} onChange={set('x')} error={errors.x} ... */}
      <div className="flex justify-end">
        <Button loading={saving} onClick={save}>Save changes</Button>
      </div>
    </div>
  )
}
```

The implementer fills in the four `Card`s exactly per the layout list above — every field bound the same way (`value={form.field_name} onChange={set('field_name')}`, error from `errors.field_name`). Note `next_invoice_number`, `id`, `updated_at` are stripped before PATCH (settingsInput doesn't accept them).

- [ ] **Step 3: Implement `src/app/settings/page.tsx`**

```tsx
import { AppShell } from '@/components/AppShell'
import { BusinessProfileForm } from '@/components/settings/BusinessProfileForm'

export default function SettingsPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-zinc-500">Your business details appear on every invoice you issue.</p>
      <div className="mt-8">
        <BusinessProfileForm />
      </div>
    </AppShell>
  )
}
```

(Task 7 converts this page to tabs: Business profile | Clients.)

- [ ] **Step 4: Manual verification**

`npm run dev`, sign in, open `/settings`: profile loads (default "Thinkware Labs" values), edit company name + address + bank details + prefix, Save → toast appears; refresh → values persisted. Enter an invalid prefix like `bad prefix!` → inline field error appears.

- [ ] **Step 5: Build and commit**

```bash
npm run build
git add src/
git commit -m "feat: add settings API and business profile page"
```

---

### Task 7: Clients API + Clients manager in settings

**Files:**
- Create: `src/app/api/clients/route.ts`, `src/app/api/clients/[id]/route.ts`
- Create: `src/components/settings/ClientsManager.tsx`, `src/components/settings/ClientFormModal.tsx`
- Modify: `src/app/settings/page.tsx` (tabs)

**Interfaces:**
- Consumes: `db`, `clientInput`, `Client`, UI kit
- Produces:
  - `GET /api/clients` → `{ clients: Client[] }` (active only, ordered by name)
  - `POST /api/clients` body `ClientInput` → `{ client: Client }` (400 on invalid)
  - `PATCH /api/clients/:id` body partial `ClientInput & { archived?: boolean }` → `{ client: Client }`
  - `ClientFormModal`: `{ open: boolean; onClose: () => void; initial?: Client | null; onSaved: (c: Client) => void }` — reused by Task 11's invoice form ("New client" inline).

- [ ] **Step 1: Implement `src/app/api/clients/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase'
import { clientInput } from '@/lib/validation'

export async function GET() {
  const { data, error } = await db.from('clients').select('*').eq('archived', false).order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ clients: data })
}

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = clientInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const { data, error } = await db.from('clients').insert(parsed.data).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ client: data }, { status: 201 })
}
```

- [ ] **Step 2: Implement `src/app/api/clients/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase'
import { clientInput } from '@/lib/validation'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const archived = typeof body.archived === 'boolean' ? body.archived : undefined
  const parsed = clientInput.partial().safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const update = { ...parsed.data, ...(archived !== undefined ? { archived } : {}) }
  const { data, error } = await db.from('clients').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ client: data })
}
```

- [ ] **Step 3: Implement `src/components/settings/ClientFormModal.tsx`**

Client component using `Modal`. Fields (same 2-col grid pattern as Task 6): Name (col-span-2, required), Email, Phone, Address line 1 (col-span-2), Address line 2 (col-span-2), City, State, Postal code, Country, Tax ID. State handling identical to BusinessProfileForm (`FormState` of strings, `set(k)` helper, `errors` from 400 `issues`). Footer: Cancel (secondary) + Save (primary, loading).

Submit: if `initial` → `PATCH /api/clients/${initial.id}`, else `POST /api/clients`. On success: `onSaved(data.client)`, `onClose()`, `toast(initial ? 'Client updated' : 'Client added')`.

```tsx
'use client'
// props: { open, onClose, initial, onSaved }
// empty(): FormState with all fields '' — when `initial` changes (useEffect on [initial, open]) reset form from initial or empty()
```

- [ ] **Step 4: Implement `src/components/settings/ClientsManager.tsx`**

Client component:
- Loads `GET /api/clients` on mount into `clients` state; `Spinner` while loading.
- Header row: search `Input` (placeholder "Search clients…", filters by name/email in-memory) + `Button` "Add client" → opens `ClientFormModal` with `initial=null`.
- Table (styled `<table>` inside `Card` with `p-0` + `overflow-hidden`): columns Name, Email, Location (city + country joined by ", "), Tax ID, actions. Header row: `text-left text-xs font-medium uppercase tracking-wide text-zinc-500 border-b border-zinc-200 bg-zinc-50`, cells `px-4 py-3 text-sm border-b border-zinc-100`. Row hover `hover:bg-zinc-50`.
- Row actions (right-aligned ghost buttons): "Edit" → modal with `initial=client`; "Archive" → `ConfirmDialog` (danger, message "Archived clients disappear from pickers but stay on existing invoices.") → `PATCH { archived: true }` → remove from list + toast.
- Empty list → `EmptyState title="No clients yet" hint="Add your first client to start invoicing." action={<Button …>Add client</Button>}`.
- `onSaved`: insert or replace in `clients` state, re-sorted by name.

- [ ] **Step 5: Add tabs to `src/app/settings/page.tsx`**

Convert to a client-side tab switcher inside the server page: create a small client component `SettingsTabs` in the same folder rendering a tab bar (`Business profile` | `Clients`) — buttons styled `px-3 py-1.5 text-sm font-medium rounded-lg`, active = `bg-zinc-900 text-white`, inactive = `text-zinc-600 hover:bg-zinc-100` — and the active panel (`BusinessProfileForm` or `ClientsManager`).

- [ ] **Step 6: Manual verification**

In `/settings` → Clients tab: add client "Magentic" with the address from the template PDF; edit it; search for it; archive a second dummy client and confirm it disappears. Refresh page — data persists.

- [ ] **Step 7: Build and commit**

```bash
npm run build
git add src/
git commit -m "feat: add clients API and clients manager"
```

---

### Task 8: Invoices API — CRUD, finalize, mark-paid

**Files:**
- Create: `src/app/api/invoices/route.ts`, `src/app/api/invoices/[id]/route.ts`, `src/app/api/invoices/[id]/finalize/route.ts`, `src/app/api/invoices/[id]/mark-paid/route.ts`

**Interfaces:**
- Consumes: `db`, `invoiceInput`, `computeTotals`, `lineAmount`, types
- Produces:
  - `GET /api/invoices` → `{ invoices: InvoiceListRow[] }` (newest first, client name joined)
  - `POST /api/invoices` body `InvoiceInput` → `{ invoice: Invoice }` 201 (status draft, totals computed server-side, items inserted)
  - `GET /api/invoices/:id` → `{ invoice: Invoice; items: InvoiceItem[]; client: Client | null }`
  - `PATCH /api/invoices/:id` body `InvoiceInput` → `{ invoice: Invoice }` (409 if not draft; items replaced)
  - `DELETE /api/invoices/:id` → `{ ok: true }` (409 if not draft)
  - `POST /api/invoices/:id/finalize` → `{ invoice: Invoice }` (assigns number, snapshots, status finalized; 409 if not draft)
  - `POST /api/invoices/:id/mark-paid` → `{ invoice: Invoice }` (409 unless finalized)

- [ ] **Step 1: Implement `src/app/api/invoices/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase'
import { invoiceInput } from '@/lib/validation'
import { computeTotals, lineAmount } from '@/lib/money'

export async function GET() {
  const { data, error } = await db
    .from('invoices')
    .select('id, invoice_number, issue_date, due_date, status, currency, total, created_at, clients(name)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invoices: data })
}

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = invoiceInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const { items, ...inv } = parsed.data
  const totals = computeTotals(items, inv.tax_rate)

  const { data: invoice, error } = await db
    .from('invoices')
    .insert({
      ...inv,
      payment_link: inv.payment_link || null,
      notes: inv.notes || null,
      tax_label: inv.tax_label || null,
      subtotal: totals.subtotal,
      tax_amount: totals.taxAmount,
      total: totals.total,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = items.map((it, i) => ({
    invoice_id: invoice.id,
    description: it.description,
    period: it.period || null,
    qty: it.qty,
    unit_price: it.unit_price,
    amount: lineAmount(it.qty, it.unit_price),
    sort_order: i,
  }))
  const { error: itemsError } = await db.from('invoice_items').insert(rows)
  if (itemsError) {
    await db.from('invoices').delete().eq('id', invoice.id) // rollback
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }
  return NextResponse.json({ invoice }, { status: 201 })
}
```

- [ ] **Step 2: Implement `src/app/api/invoices/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase'
import { invoiceInput } from '@/lib/validation'
import { computeTotals, lineAmount } from '@/lib/money'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  const { data: invoice, error } = await db.from('invoices').select('*').eq('id', id).single()
  if (error || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  const { data: items } = await db.from('invoice_items').select('*').eq('invoice_id', id).order('sort_order')
  const { data: client } = await db.from('clients').select('*').eq('id', invoice.client_id).single()
  return NextResponse.json({ invoice, items: items ?? [], client })
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  const { data: existing } = await db.from('invoices').select('id, status').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (existing.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft invoices can be edited' }, { status: 409 })
  }

  const body = await req.json()
  const parsed = invoiceInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const { items, ...inv } = parsed.data
  const totals = computeTotals(items, inv.tax_rate)

  const { data: invoice, error } = await db
    .from('invoices')
    .update({
      ...inv,
      payment_link: inv.payment_link || null,
      notes: inv.notes || null,
      tax_label: inv.tax_label || null,
      subtotal: totals.subtotal,
      tax_amount: totals.taxAmount,
      total: totals.total,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from('invoice_items').delete().eq('invoice_id', id)
  const rows = items.map((it, i) => ({
    invoice_id: id,
    description: it.description,
    period: it.period || null,
    qty: it.qty,
    unit_price: it.unit_price,
    amount: lineAmount(it.qty, it.unit_price),
    sort_order: i,
  }))
  const { error: itemsError } = await db.from('invoice_items').insert(rows)
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })
  return NextResponse.json({ invoice })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  const { data: existing } = await db.from('invoices').select('id, status').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (existing.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft invoices can be deleted' }, { status: 409 })
  }
  const { error } = await db.from('invoices').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Implement `src/app/api/invoices/[id]/finalize/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: invoice } = await db.from('invoices').select('*').eq('id', id).single()
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (invoice.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft invoices can be finalized' }, { status: 409 })
  }

  const { count } = await db.from('invoice_items').select('*', { count: 'exact', head: true }).eq('invoice_id', id)
  if (!count) return NextResponse.json({ error: 'Invoice has no items' }, { status: 400 })

  const { data: profile, error: pErr } = await db.from('business_profile').select('*').eq('id', 1).single()
  if (pErr || !profile) return NextResponse.json({ error: 'Business profile missing' }, { status: 500 })
  const { data: client, error: cErr } = await db.from('clients').select('*').eq('id', invoice.client_id).single()
  if (cErr || !client) return NextResponse.json({ error: 'Client missing' }, { status: 500 })

  const { data: number, error: nErr } = await db.rpc('allocate_invoice_number')
  if (nErr) return NextResponse.json({ error: nErr.message }, { status: 500 })

  const { data: updated, error } = await db
    .from('invoices')
    .update({
      invoice_number: number,
      status: 'finalized',
      business_snapshot: profile,
      client_snapshot: client,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invoice: updated })
}
```

(If the final update fails after the RPC, one sequence number is burned — acceptable for an internal tool; numbers stay unique.)

- [ ] **Step 4: Implement `src/app/api/invoices/[id]/mark-paid/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: existing } = await db.from('invoices').select('id, status').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (existing.status !== 'finalized') {
    return NextResponse.json({ error: 'Only finalized invoices can be marked paid' }, { status: 409 })
  }
  const { data: invoice, error } = await db
    .from('invoices')
    .update({ status: 'paid', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invoice })
}
```

- [ ] **Step 5: Verify with typecheck + build**

Run: `npm run build`
Expected: compiles clean. (Endpoint behavior is exercised end-to-end via the UI in Tasks 10–12 and the final verification pass.)

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "feat: add invoices API with finalize and mark-paid"
```

---

### Task 9: PDF template + PDF route (TDD)

**Files:**
- Create: `src/lib/pdf/InvoicePdf.tsx`
- Create: `src/app/api/invoices/[id]/pdf/route.ts`
- Test: `src/lib/pdf/InvoicePdf.test.tsx`

**Interfaces:**
- Consumes: fonts from Task 1 (`src/lib/pdf/fonts/*.ttf`), `formatMoney`, `formatDateLong`, types
- Produces:
  - `InvoicePdf(props: { data: InvoicePdfData }): JSX element` and `interface InvoicePdfData` (exported)
  - `GET /api/invoices/:id/pdf[?download=1]` → `application/pdf` stream, filename `Invoice-<number|DRAFT>.pdf`, `Content-Disposition` inline by default / attachment when `download=1`. Drafts render from live profile+client data with number "DRAFT"; finalized/paid render from snapshots.

- [ ] **Step 1: Write the failing render test**

Create `src/lib/pdf/InvoicePdf.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { InvoicePdf, InvoicePdfData } from './InvoicePdf'

const sample: InvoicePdfData = {
  number: 'TWL-0001',
  issueDate: '2026-07-10',
  dueDate: '2026-07-10',
  business: {
    company_name: 'Thinkware Labs',
    address_line1: '440 N Barranca Ave #4133',
    address_line2: null,
    city: 'Covina', state: 'California', postal_code: '91723', country: 'United States',
    email: 'contact@gomagentic.com', phone: null,
    tax_id: '9926USA29034OS9',
    legal_note: 'Registered person liable for GST/VAT under reverse charge.',
    bank_account_name: 'Thinkware Labs', bank_name: 'HDFC Bank',
    bank_account_number: '1234567890', bank_ifsc: 'HDFC0000001', bank_swift: null,
  },
  client: {
    name: 'Magentic',
    address_line1: 'Octus Quantum samaspur sector 51', address_line2: null,
    city: 'Gurugram', state: 'MAHARASHTRA', postal_code: '122001', country: 'India',
    email: 'dev@magentic.in', tax_id: null,
  },
  currency: 'USD',
  taxLabel: 'IGST - INDIA',
  taxRate: 18,
  paymentLink: null,
  notes: null,
  items: [{ description: 'Pro', period: 'Jul 10–Aug 9, 2026', qty: 1, unitPrice: 20, amount: 20 }],
  subtotal: 20,
  taxAmount: 3.6,
  total: 23.6,
}

describe('InvoicePdf', () => {
  it('renders a valid one-page PDF', async () => {
    const buf = await renderToBuffer(InvoicePdf({ data: sample }))
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(buf.length).toBeGreaterThan(10_000)
  })
  it('renders without optional fields (draft, no tax, no bank)', async () => {
    const minimal: InvoicePdfData = {
      ...sample,
      number: 'DRAFT',
      taxLabel: null, taxRate: 0, taxAmount: 0, total: 20,
      business: { ...sample.business, tax_id: null, legal_note: null, bank_account_name: null, bank_name: null, bank_account_number: null, bank_ifsc: null, bank_swift: null },
    }
    const buf = await renderToBuffer(InvoicePdf({ data: minimal }))
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/lib/pdf/InvoicePdf.test.tsx`
Expected: FAIL — `./InvoicePdf` not found.

- [ ] **Step 3: Implement `src/lib/pdf/InvoicePdf.tsx`**

The layout mirrors `Invoice-WD7VNO2J-0012.pdf` exactly (A4, 40pt padding, Inter):

```tsx
import path from 'node:path'
import { Document, Font, Image, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { formatMoney } from '@/lib/money'
import { formatDateLong } from '@/lib/dates'

const fontsDir = path.join(process.cwd(), 'src/lib/pdf/fonts')
Font.register({
  family: 'Inter',
  fonts: [
    { src: path.join(fontsDir, 'Inter_400Regular.ttf'), fontWeight: 400 },
    { src: path.join(fontsDir, 'Inter_500Medium.ttf'), fontWeight: 500 },
    { src: path.join(fontsDir, 'Inter_600SemiBold.ttf'), fontWeight: 600 },
    { src: path.join(fontsDir, 'Inter_700Bold.ttf'), fontWeight: 700 },
  ],
})

export interface PdfParty {
  company_name?: string
  name?: string
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  email: string | null
  phone?: string | null
  tax_id: string | null
  legal_note?: string | null
  bank_account_name?: string | null
  bank_name?: string | null
  bank_account_number?: string | null
  bank_ifsc?: string | null
  bank_swift?: string | null
}

export interface InvoicePdfData {
  number: string
  issueDate: string
  dueDate: string
  business: PdfParty
  client: PdfParty
  currency: string
  taxLabel: string | null
  taxRate: number
  paymentLink: string | null
  notes: string | null
  items: { description: string; period: string | null; qty: number; unitPrice: number; amount: number }[]
  subtotal: number
  taxAmount: number
  total: number
}

const s = StyleSheet.create({
  page: { fontFamily: 'Inter', fontSize: 9, color: '#18181b', paddingTop: 40, paddingHorizontal: 44, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: 700, letterSpacing: -0.3 },
  logo: { width: 120 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  metaTable: { marginTop: 14, gap: 3 },
  metaRow: { flexDirection: 'row' },
  metaLabel: { width: 90, fontWeight: 600 },
  parties: { flexDirection: 'row', marginTop: 26, gap: 60 },
  party: { width: 220, gap: 2.5 },
  partyName: { fontWeight: 600, marginBottom: 2 },
  billToLabel: { fontWeight: 600, marginBottom: 2 },
  banner: { marginTop: 30, fontSize: 15, fontWeight: 600, letterSpacing: -0.2 },
  payLink: { marginTop: 10, color: '#4353ff', textDecoration: 'underline' },
  legal: { marginTop: 14, gap: 2.5, color: '#3f3f46' },
  table: { marginTop: 26 },
  thead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#18181b', paddingBottom: 5, color: '#52525b' },
  tr: { flexDirection: 'row', paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: '#e4e4e7' },
  colDesc: { flex: 1, paddingRight: 8 },
  colQty: { width: 40, textAlign: 'right' },
  colPrice: { width: 70, textAlign: 'right' },
  colTax: { width: 50, textAlign: 'right' },
  colAmount: { width: 80, textAlign: 'right' },
  period: { color: '#71717a', marginTop: 2 },
  totals: { marginTop: 4, alignSelf: 'flex-end', width: 260 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: '#e4e4e7' },
  totalStrong: { fontWeight: 700 },
  bank: { marginTop: 34, gap: 2.5 },
  bankTitle: { fontWeight: 600, marginBottom: 2 },
  bankRow: { flexDirection: 'row' },
  bankLabel: { width: 130, color: '#52525b' },
  notes: { marginTop: 22, color: '#3f3f46' },
  footer: { position: 'absolute', bottom: 24, left: 44, right: 44, borderTopWidth: 0.5, borderTopColor: '#e4e4e7', paddingTop: 8, color: '#71717a', fontSize: 8, textAlign: 'right' },
})

function partyLines(p: PdfParty): string[] {
  const cityLine = [p.city, p.postal_code].filter(Boolean).join(' ')
  return [p.address_line1, p.address_line2, cityLine, p.state, p.country, p.email, p.phone]
    .filter((x): x is string => Boolean(x && x.trim()))
}

export function InvoicePdf({ data }: { data: InvoicePdfData }) {
  const fm = (n: number) => formatMoney(n, data.currency)
  const bank: [string, string | null | undefined][] = [
    ['Account holder', data.business.bank_account_name],
    ['Bank', data.business.bank_name],
    ['Account number', data.business.bank_account_number],
    ['IFSC', data.business.bank_ifsc],
    ['SWIFT', data.business.bank_swift],
  ]
  const hasBank = bank.some(([, v]) => v)

  return (
    <Document title={`Invoice ${data.number}`}>
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <Text style={s.title}>Invoice</Text>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image style={s.logo} src={path.join(process.cwd(), 'public/logo.png')} />
        </View>

        <View style={s.metaTable}>
          <View style={s.metaRow}><Text style={s.metaLabel}>Invoice number</Text><Text>{data.number}</Text></View>
          <View style={s.metaRow}><Text style={s.metaLabel}>Date of issue</Text><Text>{formatDateLong(data.issueDate)}</Text></View>
          <View style={s.metaRow}><Text style={s.metaLabel}>Date due</Text><Text>{formatDateLong(data.dueDate)}</Text></View>
        </View>

        <View style={s.parties}>
          <View style={s.party}>
            <Text style={s.partyName}>{data.business.company_name}</Text>
            {partyLines(data.business).map((l, i) => <Text key={i}>{l}</Text>)}
          </View>
          <View style={s.party}>
            <Text style={s.billToLabel}>Bill to</Text>
            <Text>{data.client.name}</Text>
            {partyLines(data.client).map((l, i) => <Text key={i}>{l}</Text>)}
          </View>
        </View>

        <Text style={s.banner}>
          {fm(data.total)} {data.currency} due {formatDateLong(data.dueDate)}
        </Text>
        {data.paymentLink && <Link style={s.payLink} src={data.paymentLink}>Pay online</Link>}

        {(data.business.tax_id || data.business.legal_note) && (
          <View style={s.legal}>
            {data.business.tax_id && <Text>{data.business.company_name} tax ID: {data.business.tax_id}</Text>}
            {data.business.legal_note && <Text>{data.business.legal_note}</Text>}
          </View>
        )}

        <View style={s.table}>
          <View style={s.thead}>
            <Text style={s.colDesc}>Description</Text>
            <Text style={s.colQty}>Qty</Text>
            <Text style={s.colPrice}>Unit price</Text>
            <Text style={s.colTax}>Tax</Text>
            <Text style={s.colAmount}>Amount</Text>
          </View>
          {data.items.map((it, i) => (
            <View key={i} style={s.tr}>
              <View style={s.colDesc}>
                <Text style={{ fontWeight: 500 }}>{it.description}</Text>
                {it.period && <Text style={s.period}>{it.period}</Text>}
              </View>
              <Text style={s.colQty}>{it.qty}</Text>
              <Text style={s.colPrice}>{fm(it.unitPrice)}</Text>
              <Text style={s.colTax}>{data.taxRate > 0 ? `${data.taxRate}%` : '—'}</Text>
              <Text style={s.colAmount}>{fm(it.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={s.totals}>
          <View style={s.totalRow}><Text>Subtotal</Text><Text>{fm(data.subtotal)}</Text></View>
          <View style={s.totalRow}><Text>Total excluding tax</Text><Text>{fm(data.subtotal)}</Text></View>
          {data.taxRate > 0 && (
            <View style={s.totalRow}>
              <Text>{data.taxLabel || 'Tax'} ({data.taxRate}% on {fm(data.subtotal)})</Text>
              <Text>{fm(data.taxAmount)}</Text>
            </View>
          )}
          <View style={s.totalRow}><Text>Total</Text><Text>{fm(data.total)}</Text></View>
          <View style={[s.totalRow, { borderBottomWidth: 0 }]}>
            <Text style={s.totalStrong}>Amount due</Text>
            <Text style={s.totalStrong}>{fm(data.total)} {data.currency}</Text>
          </View>
        </View>

        {hasBank && (
          <View style={s.bank}>
            <Text style={s.bankTitle}>Payment details</Text>
            {bank.filter(([, v]) => v).map(([label, v]) => (
              <View key={label} style={s.bankRow}>
                <Text style={s.bankLabel}>{label}</Text>
                <Text>{v}</Text>
              </View>
            ))}
          </View>
        )}

        {data.notes && <Text style={s.notes}>{data.notes}</Text>}

        <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </Page>
    </Document>
  )
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run src/lib/pdf/InvoicePdf.test.tsx`
Expected: PASS (both cases). If fonts fail to load, re-check Task 1 Step 4 files.

- [ ] **Step 5: Implement `src/app/api/invoices/[id]/pdf/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { db } from '@/lib/supabase'
import { InvoicePdf, InvoicePdfData, PdfParty } from '@/lib/pdf/InvoicePdf'
import { BusinessProfile, Client, Invoice, InvoiceItem } from '@/lib/types'

export const runtime = 'nodejs'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = new URL(req.url)
  const download = url.searchParams.get('download') === '1'

  const { data: invoice } = await db.from('invoices').select('*').eq('id', id).single<Invoice>()
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const { data: items } = await db
    .from('invoice_items').select('*').eq('invoice_id', id).order('sort_order').returns<InvoiceItem[]>()

  let business: BusinessProfile | null = invoice.business_snapshot
  let client: Client | null = invoice.client_snapshot
  if (!business) {
    const { data } = await db.from('business_profile').select('*').eq('id', 1).single<BusinessProfile>()
    business = data
  }
  if (!client) {
    const { data } = await db.from('clients').select('*').eq('id', invoice.client_id).single<Client>()
    client = data
  }
  if (!business || !client) return NextResponse.json({ error: 'Invoice data incomplete' }, { status: 500 })

  const data: InvoicePdfData = {
    number: invoice.invoice_number ?? 'DRAFT',
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    business: business as PdfParty,
    client: { ...client, name: client.name } as PdfParty,
    currency: invoice.currency,
    taxLabel: invoice.tax_label,
    taxRate: Number(invoice.tax_rate),
    paymentLink: invoice.payment_link,
    notes: invoice.notes,
    items: (items ?? []).map((it) => ({
      description: it.description,
      period: it.period,
      qty: Number(it.qty),
      unitPrice: Number(it.unit_price),
      amount: Number(it.amount),
    })),
    subtotal: Number(invoice.subtotal),
    taxAmount: Number(invoice.tax_amount),
    total: Number(invoice.total),
  }

  const buffer = await renderToBuffer(InvoicePdf({ data }))
  const filename = `Invoice-${invoice.invoice_number ?? 'DRAFT'}.pdf`
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
```

Note: numeric columns come back from Supabase as strings for `numeric` type — hence the `Number(...)` coercions.

- [ ] **Step 6: Build and commit**

```bash
npm run build
git add src/
git commit -m "feat: add invoice PDF template and pdf generation endpoint"
```

---

### Task 10: Dashboard — invoices list

**Files:**
- Create: `src/app/page.tsx`, `src/components/invoices/InvoiceList.tsx`

**Interfaces:**
- Consumes: `GET /api/invoices`, `DELETE /api/invoices/:id`, `POST /api/invoices/:id/mark-paid`, `InvoiceListRow`, `formatMoney`, `formatDateLong`, UI kit, `AppShell`
- Produces: home page listing invoices with search/filter/actions; "New invoice" links to `/invoices/new` (Task 11); rows link to `/invoices/{id}` (Task 12).

- [ ] **Step 1: Replace `src/app/page.tsx`**

```tsx
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/ui/Button'
import { InvoiceList } from '@/components/invoices/InvoiceList'

export default function HomePage() {
  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="mt-1 text-sm text-zinc-500">Create, track and download your invoices.</p>
        </div>
        <Link href="/invoices/new"><Button>New invoice</Button></Link>
      </div>
      <div className="mt-8">
        <InvoiceList />
      </div>
    </AppShell>
  )
}
```

Also delete the create-next-app boilerplate assets it referenced (`src/app/page.module.css` if present, unused svgs in `public/`: `next.svg`, `vercel.svg`, `globe.svg`, `file.svg`, `window.svg`).

- [ ] **Step 2: Implement `src/components/invoices/InvoiceList.tsx`**

Client component. Full behavior spec:

**State:** `invoices: InvoiceListRow[] | null`, `q: string`, `statusFilter: 'all' | InvoiceStatus`, `confirmDelete: InvoiceListRow | null`.

**Load:** on mount `fetch('/api/invoices')` → `setInvoices(d.invoices)`; error → toast. `Spinner` centered while `null`.

**Summary cards** (row of 3 `Card`s, computed from loaded data):
- "Outstanding" — sum of `total` where status `finalized`, grouped by currency, rendered like `$1,200.00 · ₹45,000.00` (join with ` · `); `—` when zero invoices.
- "Paid" — same aggregation for status `paid`.
- "Total invoices" — count.
Each card: label `text-xs uppercase tracking-wide text-zinc-500`, value `mt-2 text-2xl font-semibold tracking-tight`.

Aggregation helper (inside the file):

```tsx
function sumByCurrency(rows: InvoiceListRow[]): string {
  const sums = new Map<string, number>()
  for (const r of rows) sums.set(r.currency, (sums.get(r.currency) ?? 0) + Number(r.total))
  if (sums.size === 0) return '—'
  return [...sums.entries()].map(([c, n]) => formatMoney(n, c)).join(' · ')
}
```

**Filter bar:** search `Input` (placeholder "Search by number or client…", `max-w-xs`) + status tabs (All / Draft / Finalized / Paid) using the same pill styling as Task 7's tabs. Filtering is in-memory: match `q` (lowercased) against `invoice_number ?? ''` and `clients?.name ?? ''`; status must equal filter unless `all`.

**Table** (inside `Card className="p-0 overflow-hidden"`, same table styling as Task 7): columns Number, Client, Issue date, Total, Status, Actions.
- Number cell: `invoice_number ?? '—'` in `font-medium`; whole row wrapped in click-through to `/invoices/{id}` (use `onClick={() => router.push(...)}` on `<tr className="cursor-pointer hover:bg-zinc-50">`; action buttons call `e.stopPropagation()`).
- Total: `formatMoney(Number(r.total), r.currency)`, Issue date: `formatDateLong`.
- Status: `Badge`.
- Actions (ghost buttons, right-aligned): "PDF" (always, `router.push('/invoices/'+id)`), "Edit" (draft only → `/invoices/{id}/edit`), "Mark paid" (finalized only → `POST /api/invoices/{id}/mark-paid`, then update row in state + toast `Marked as paid`), "Delete" (draft only → sets `confirmDelete`).

**Delete:** `ConfirmDialog danger title="Delete draft?" message="This permanently deletes the draft invoice." confirmLabel="Delete"` → `DELETE /api/invoices/{id}` → remove from state + toast.

**Empty state:** `EmptyState title="No invoices yet" hint="Create your first invoice to get started." action={<Link href="/invoices/new"><Button>New invoice</Button></Link>}` (only when list empty AND no filters active; if filters active show a plain "No matches" row).

- [ ] **Step 3: Manual verification**

`/` shows empty state → after Task 11/12 revisit. For now: page loads with 0 invoices, cards show `—` / `—` / `0`, tabs and search render.

- [ ] **Step 4: Build and commit**

```bash
npm run build
git add -A
git commit -m "feat: add invoices dashboard with summary cards, search and filters"
```

---

### Task 11: Invoice create/edit form

**Files:**
- Create: `src/components/invoices/InvoiceForm.tsx`, `src/components/invoices/ClientPicker.tsx`
- Create: `src/app/invoices/new/page.tsx`, `src/app/invoices/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `GET /api/settings`, `GET /api/clients`, `POST/PATCH /api/invoices`, `POST /api/invoices/:id/finalize`, `GET /api/invoices/:id`, `ClientFormModal` from Task 7, `computeTotals`, `formatMoney`, `todayISO`, UI kit
- Produces:
  - `/invoices/new` and `/invoices/[id]/edit` pages
  - `InvoiceForm`: `{ invoiceId?: string }` — create mode when undefined, edit mode loads the draft
  - `ClientPicker`: `{ clients: Client[]; value: string; onChange: (id: string) => void; onClientAdded: (c: Client) => void; error?: string }`

- [ ] **Step 1: Implement `src/components/invoices/ClientPicker.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { ClientFormModal } from '@/components/settings/ClientFormModal'
import { Client } from '@/lib/types'

export function ClientPicker({ clients, value, onChange, onClientAdded, error }: {
  clients: Client[]
  value: string
  onChange: (id: string) => void
  onClientAdded: (c: Client) => void
  error?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div className="flex gap-2">
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select a client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>New client</Button>
      </div>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
      <ClientFormModal
        open={open}
        onClose={() => setOpen(false)}
        initial={null}
        onSaved={(c) => { onClientAdded(c); onChange(c.id) }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Implement `src/components/invoices/InvoiceForm.tsx`**

Client component, the heart of the app. Full behavior spec:

**Item row state:** `{ key: number; description: string; period: string; qty: string; unit_price: string }` — qty/price kept as strings for typing comfort; parsed with `Number()` for totals and submit.

**Form state:** `client_id`, `issue_date` (default `todayISO()`), `due_date` (default `todayISO()`), `currency`, `tax_label`, `tax_rate` (string), `payment_link`, `notes`, `items: ItemRow[]` (starts with one empty row), plus `clients: Client[]`, `errors`, `saving: 'draft' | 'finalize' | null`, `loading`.

**Init (create mode):** parallel `fetch('/api/settings')` + `fetch('/api/clients')`; defaults from profile: `currency = default_currency`, `tax_label = default_tax_label ?? ''`, `tax_rate = String(default_tax_rate)`.
**Init (edit mode, `invoiceId` set):** also `fetch('/api/invoices/'+invoiceId)`; if `invoice.status !== 'draft'` → `router.replace('/invoices/'+invoiceId)` (finalized invoices can't be edited); prefill all fields and items (map DB rows to string state, `Number(...)` → `String(...)`).

**Layout:** two-column: left `flex-1` form, right `w-72` sticky summary panel.
- Card "Details": ClientPicker (Field label "Client"), 2-col grid: Issue date / Due date (`Input type="date"`), Currency (`Select`, CURRENCIES list from Task 6), Tax rate % (`Input type="number" step="0.01" min="0" max="100"`), Tax label (col-span-2, placeholder "e.g. IGST - INDIA").
- Card "Line items": each row a 12-col grid — Description (col-span-5, `Input`), Period (col-span-3, placeholder "e.g. Jul 10–Aug 9, 2026"), Qty (col-span-1, number), Unit price (col-span-2, number), delete row button (col-span-1, ghost ×, disabled when only one row). Under description show nothing else. "Add item" ghost button below with a `+`. Per-row live amount shown right-aligned under unit price is NOT needed — the summary panel covers totals.
- Card "Extras": Payment link (`Input type="url"`, placeholder "https:// … optional"), Notes (`Textarea`, optional).
- Summary panel (Card, `sticky top-10`): rows Subtotal / Tax (label shows `tax_label || 'Tax'` + rate) / Total (semibold, larger) using `computeTotals(parsedItems, Number(tax_rate) || 0)` and `formatMoney(..., currency)` recomputed every render; then two full-width buttons: primary "Finalize & download PDF" (`loading={saving==='finalize'}`), secondary "Save draft" (`loading={saving==='draft'}`).

**Client-side validation before submit:** client selected; both dates set; at least one item with non-empty description, `Number(qty) > 0`, `Number(unit_price) >= 0`. Set `errors` per field (e.g. `errors.client_id`, `errors.items`), toast 'Fix the highlighted fields' and abort if any.

**Payload builder:**

```tsx
function payload() {
  return {
    client_id: form.client_id,
    issue_date: form.issue_date,
    due_date: form.due_date,
    currency: form.currency,
    tax_label: form.tax_label.trim(),
    tax_rate: Number(form.tax_rate) || 0,
    payment_link: form.payment_link.trim(),
    notes: form.notes.trim(),
    items: form.items
      .filter((r) => r.description.trim())
      .map((r) => ({
        description: r.description.trim(),
        period: r.period.trim(),
        qty: Number(r.qty),
        unit_price: Number(r.unit_price),
      })),
  }
}
```

**Save draft:** `POST /api/invoices` (create) or `PATCH /api/invoices/{invoiceId}` (edit) → on success `router.push('/invoices/'+invoice.id)` + toast 'Draft saved'. On 400 map `issues` to errors.

**Finalize:** save first (same call), then `POST /api/invoices/{id}/finalize`; on success `router.push('/invoices/'+id+'?autodownload=1')`. If finalize returns an error, toast it (the draft is already saved — user lands on it via the list).

- [ ] **Step 3: Create the pages**

`src/app/invoices/new/page.tsx`:

```tsx
import { AppShell } from '@/components/AppShell'
import { InvoiceForm } from '@/components/invoices/InvoiceForm'

export default function NewInvoicePage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">New invoice</h1>
      <div className="mt-8">
        <InvoiceForm />
      </div>
    </AppShell>
  )
}
```

`src/app/invoices/[id]/edit/page.tsx`:

```tsx
import { AppShell } from '@/components/AppShell'
import { InvoiceForm } from '@/components/invoices/InvoiceForm'

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Edit invoice</h1>
      <div className="mt-8">
        <InvoiceForm invoiceId={id} />
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 4: Manual verification**

Create an invoice replicating the template: client Magentic, 1 × "Pro" at $20, period "Jul 10–Aug 9, 2026", 18% "IGST - INDIA". Summary panel must show $20.00 / $3.60 / $23.60 live. Save draft → lands on detail (404 page for now is fine if Task 12 not done — verify via dashboard list instead: row appears as Draft). Edit the draft → change qty to 2 → totals update → save.

- [ ] **Step 5: Build and commit**

```bash
npm run build
git add src/
git commit -m "feat: add invoice create/edit form with live totals and inline client creation"
```

---

### Task 12: Invoice detail page — PDF preview, download, actions

**Files:**
- Create: `src/app/invoices/[id]/page.tsx`, `src/components/invoices/InvoiceDetail.tsx`

**Interfaces:**
- Consumes: `GET /api/invoices/:id`, `POST /api/invoices/:id/mark-paid`, `GET /api/invoices/:id/pdf`, UI kit
- Produces: `/invoices/[id]` page with iframe PDF preview, Download, Edit (draft), Finalize (draft), Mark paid (finalized), auto-download on `?autodownload=1`.

- [ ] **Step 1: Create `src/app/invoices/[id]/page.tsx`**

```tsx
import { Suspense } from 'react'
import { AppShell } from '@/components/AppShell'
import { InvoiceDetail } from '@/components/invoices/InvoiceDetail'

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <AppShell>
      <Suspense>
        <InvoiceDetail id={id} />
      </Suspense>
    </AppShell>
  )
}
```

(`Suspense` is required because `InvoiceDetail` uses `useSearchParams`.)

- [ ] **Step 2: Implement `src/components/invoices/InvoiceDetail.tsx`**

```tsx
'use client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { formatDateLong } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { Client, Invoice } from '@/lib/types'

export function InvoiceDetail({ id }: { id: string }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState<'finalize' | 'paid' | null>(null)
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const downloaded = useRef(false)

  const pdfUrl = `/api/invoices/${id}/pdf`

  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setInvoice(d.invoice); setClient(d.client) })
      .catch(() => setNotFound(true))
  }, [id])

  // auto-download once for freshly finalized invoices
  useEffect(() => {
    if (searchParams.get('autodownload') === '1' && !downloaded.current) {
      downloaded.current = true
      const a = document.createElement('a')
      a.href = `${pdfUrl}?download=1`
      document.body.appendChild(a)
      a.click()
      a.remove()
      router.replace(`/invoices/${id}`, { scroll: false })
    }
  }, [searchParams, pdfUrl, id, router])

  if (notFound) return <p className="py-20 text-center text-sm text-zinc-500">Invoice not found.</p>
  if (!invoice) return <div className="flex justify-center py-20"><Spinner className="size-6 text-zinc-400" /></div>

  async function post(path: 'finalize' | 'mark-paid', kind: 'finalize' | 'paid') {
    setBusy(kind)
    const res = await fetch(`/api/invoices/${id}/${path}`, { method: 'POST' })
    setBusy(null)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) return toast(d.error ?? 'Something went wrong', 'error')
    setInvoice(d.invoice)
    if (kind === 'finalize') {
      toast(`Invoice ${d.invoice.invoice_number} finalized`)
      const a = document.createElement('a')
      a.href = `${pdfUrl}?download=1`
      document.body.appendChild(a); a.click(); a.remove()
    } else {
      toast('Marked as paid')
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{invoice.invoice_number ?? 'Draft invoice'}</h1>
            <Badge status={invoice.status} />
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {client?.name} · {formatMoney(Number(invoice.total), invoice.currency)} · due {formatDateLong(invoice.due_date)}
          </p>
        </div>
        <div className="flex gap-2">
          {invoice.status === 'draft' && (
            <>
              <Link href={`/invoices/${id}/edit`}><Button variant="secondary">Edit</Button></Link>
              <Button loading={busy === 'finalize'} onClick={() => post('finalize', 'finalize')}>Finalize</Button>
            </>
          )}
          {invoice.status === 'finalized' && (
            <Button variant="secondary" loading={busy === 'paid'} onClick={() => post('mark-paid', 'paid')}>Mark paid</Button>
          )}
          <a href={`${pdfUrl}?download=1`}><Button>Download PDF</Button></a>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <iframe
          key={invoice.status} // re-render preview after finalize (number appears)
          src={`${pdfUrl}#toolbar=0&navpanes=0`}
          className="h-[75vh] w-full"
          title="Invoice PDF preview"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Manual verification**

- Open a draft from the dashboard → preview shows number "DRAFT", Edit + Finalize buttons.
- Finalize → number assigned (e.g. TWL-0001), PDF auto-downloads, preview refreshes with the real number, badge flips to Finalized.
- From the invoice form, "Finalize & download PDF" → lands here with `?autodownload=1` → auto-download fires exactly once and the URL param is cleaned.
- Download PDF button → file `Invoice-TWL-0001.pdf` downloads.
- Mark paid → badge flips to Paid.
- Compare downloaded PDF against `Invoice-WD7VNO2J-0012.pdf` side by side: header, meta block, two address columns, banner, items table, totals stack, payment details block, page footer.

- [ ] **Step 4: Build and commit**

```bash
npm run build
git add src/
git commit -m "feat: add invoice detail page with pdf preview, download and status actions"
```

---

### Task 13: End-to-end verification, snapshot check, README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: everything.

- [ ] **Step 1: Full E2E pass (dev server, allowlisted account)**

Walk the entire flow and check every box:

1. Signed-out visit to `/` → redirected to `/signin`.
2. Sign in with allowlisted account → dashboard.
3. Settings → Business profile: fill real company details, bank details, prefix `TWL`, defaults (USD, IGST - INDIA, 18) → Save → reload → persisted.
4. Settings → Clients: add a client.
5. New invoice → template replica (1 × Pro $20, 18%) → live totals $20.00/$3.60/$23.60 → "Finalize & download PDF".
6. Auto-download fires once; file named `Invoice-TWL-0001.pdf`; preview shows the same document.
7. PDF content matches template layout (visual diff against `Invoice-WD7VNO2J-0012.pdf`): fonts, spacing, all blocks present incl. Payment details.
8. **Snapshot check:** Settings → change company address → the finalized invoice's PDF is UNCHANGED (renders from snapshot); a NEW draft's PDF shows the new address.
9. Mark paid → dashboard cards move the amount from Outstanding to Paid.
10. Draft lifecycle: create another draft → edit → delete → gone.
11. `npm run test` → all green. `npm run build` → clean.

Fix anything that fails before proceeding (use superpowers:systematic-debugging).

- [ ] **Step 2: Write README**

Replace `README.md` with concise sections: what the app is, prerequisites, env vars table (names + where to get values — no secrets), Supabase setup (paste `supabase/schema.sql` in SQL editor, run `node scripts/check-db.mjs`), Google OAuth setup (origins + redirect URI incl. production note), `npm run dev/test/build`, and a note that PDFs are generated on demand from structured data (none stored).

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "docs: add setup README"
```

---

## Self-Review Notes

- Spec coverage: sign-in gate + allowlist (T4), dashboard/search/filter/actions (T10), create/edit with live totals + inline client creation (T11), finalize with atomic numbering + snapshots (T8/T2), on-demand PDF matching template incl. bank block + optional pay link (T9), in-app preview + download + auto-download-once (T12), settings for profile/clients (T6/T7), no PDFs stored (T9 route streams only), env-driven allowlist (T4). Out-of-scope items from spec remain out.
- Type consistency: `InvoicePdfData`/`PdfParty` defined in T9 and consumed only there; `ClientFormModal` props defined in T7 and reused in T11; API response shapes declared in each task's Interfaces block match consumers in T10–T12. Supabase `numeric` → string coercion handled with `Number(...)` at every read site (T9 route, T10 list, T12 detail).
- Known accepted trade-offs: two-step insert (invoice + items) with manual rollback instead of a DB transaction; burned sequence number if finalize fails mid-way; in-memory search/filter (internal tool, small data).


