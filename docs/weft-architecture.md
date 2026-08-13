# Weft — architecture

Final as of 2026-08-13. Supersedes the version written against the two-database
assumption; that constraint disappeared when we established there was only one
invoice to carry over.

`CLAUDE.md` is the short version — the rules without the argument. This document
is the reasoning, so that when a rule looks inconvenient in six months you can
find out whether it still applies.

---

## 1. Where this came from

Two live Next.js apps, audited at `invoice@d88a4c4` (51 commits, ~6,200 LOC) and
`trove@91020a2` (12 commits, ~3,200 LOC). They shared nothing: different Supabase
projects, different data layers (`supabase-js` vs Prisma), different session
strategies (JWT vs database), different auth providers, different guard patterns,
different GitHub orgs.

**The finding that shaped everything.** Invoice's authorization was middleware
and nothing else. `middleware.ts` asked one question — *is there any session?* —
and 15 of 17 API route files trusted the answer, including
`GET /api/invoices/[id]/pdf`, which streams a complete invoice from an id in the
URL. That was safe only because every session belonged to one of three trusted
people. It stops being safe the moment a second kind of credential exists.

**The correction that followed.** Trove's magic-link login looked like the
obvious basis for client access. It isn't. Auth.js's Resend provider is an
*identity* mechanism: clicking the link creates a `User` row and a database
`Session`, asserting "you are a user of this application". It cannot express
"…and only project X". Routed through the same NextAuth instance, a client would
hold a credential satisfying every `if (session.user)` check in the codebase.

Those two facts together are why the client boundary is a separate mechanism
rather than a second provider, and why `requireInternal()` is mandatory rather
than advisory.

**What was worth keeping.** Invoice's `src/components/ui/` (13 primitives) is the
platform shell already written; its `src/lib/` separates pure logic from I/O well
enough that 92 tests survived the port untouched; the GST-inclusive pricing maths
is fiddly and correct; `allocate_invoice_number()` is race-free. Trove
contributed its Drive integration, its magic-link email template, and the
append-only Idea discipline. Hence: the Invoice repo became Weft, and Trove ports
into it.

## 2. Shape

One repo, one Next.js app, one Vercel project, one Postgres database. Not a
monorepo, not services. Three users.

```
weft/
  prisma/
    schema.prisma              # the whole model, final
    raw/001_init_extras.sql    # CHECK constraints, plpgsql, tsvector, RLS
  src/
    app/
      (internal)/              # Google Workspace SSO required
        invoices/ clients/ projects/ financials/ settings/ audit/
        ideas/ vault/ search/           # ported from Trove, Step 6
      (client)/
        f/                     # the ONLY externally reachable surface
      api/
        internal/...
        client/...
    lib/
      db.ts                    # Prisma singleton + Decimal helpers
      auth/internal.ts         # requireInternal()
      auth/client-token.ts     # mint / exchange / verify capability tokens
      client-scope.ts          # THE CHOKEPOINT for all client data access
      money.ts gst.ts ...      # ported unchanged, still tested
```

### Why one database

The earlier draft kept two, which bought a *physical* isolation guarantee: code
without credentials for the invoicing database cannot leak an invoice, no matter
how badly a query is written. Consolidating gives that up, and it's worth being
honest that this is a real loss.

Three things replace it, and together they're stronger:

1. **No resource ids in client-facing routes** (§4.2). This eliminates the bug
   class rather than defending against it.
2. **A fixed-function chokepoint** (`client-scope.ts`) rather than a scoped
   database client. An extended Prisma client still exposes `findMany` on every
   model; a named set of functions cannot be pointed at the wrong table.
3. **ESLint zones** that make a violating import a build failure.

What consolidation buys: real foreign keys, transactions (Invoice's
invoice-plus-items write was not atomic, because `supabase-js` cannot open one),
typed joins, one migration system, and no cross-database reconciliation job.

## 3. Data model

`Client` is the spine. `Project` is the unit of scope. Everything hangs off those.

```
Client ──┬── Project ──┬── Invoice ── InvoiceItem
         │             ├── TimelineEntry      (note | feedback | milestone | status_change)
         │             ├── ClientAccessToken  ← scope lives here
         │             ├── FeedbackRequest
         │             └── Idea?              (optional tag, never client-visible)
         └── ClientContact ──┬── ClientAccessToken
                             └── TimelineEntry (as client author)
```

Decisions worth recording:

**`Project` is first-class, and `Invoice.projectId` is required.** "Scoped,
expiring links, per project" only means something if Project exists. Nullable
scope keys are where row-level bugs live — "null means all projects" is one bad
query away. With no legacy rows to accommodate there was no reason to allow it.
One-off work gets an "Ad hoc" project; the UI creates one rather than writing a
null.

**`Client.billingEmail` and `ClientContact` are separate.** Invoice's single
`clients.email` was doing double duty. The address on a PDF and the humans who
leave feedback are different populations; conflating them is how a client's
accounts department ends up holding a feedback link.

**Thread and Feedback are one object.** Your instinct was right — they're the
same record authored by different parties, so they're one table with an
`authorType`. But because the entire scoping design depends on never confusing
them, exclusivity is a database CHECK constraint, not an application rule:

```sql
check (
  (author_type = 'internal' and author_user_id is not null and author_contact_id is null)
  or
  (author_type = 'client'   and author_contact_id is not null and author_user_id is null)
)
```

plus a second constraint forbidding a client-authored row from carrying an
internal-only `kind`.

**Onboarding is on `Project`, not `Client`.** A studio onboards an engagement.
When the same client hires you again, a client-level status is already `active`
and there's nowhere to put the new checklist.

**A `User` table, but no Auth.js adapter tables.** Sessions are stateless JWTs,
so `Account`/`Session`/`VerificationToken` aren't needed. `User` exists anyway so
authorship is a real foreign key — it survives name changes and gives Ideas,
Comments and Files something to point at. Rows are upserted in the `signIn`
callback.

**Money is `Decimal(14,2)`, converted at the boundary.** Correct for invoicing.
Prisma returns `Prisma.Decimal`; `money.ts` and `gst.ts` work in `number` and
have 26 passing tests. `num()`/`nums()` in `lib/db.ts` convert at the
data-access edge so the tested maths never learns Decimal exists. At
invoice-sized values that's exact — float drift is an accumulate-over-millions
problem, and Postgres holds the authoritative rounded value regardless.

## 4. Auth

Two mechanisms. They share no NextAuth instance, no cookie, no signing key, no
session table. That separation is the design, not an implementation detail.

### 4.1 Internal

Google sign-in, JWT sessions. The access rule lives in `lib/auth/identity.ts` —
pure, no I/O, unit-tested — and has two exclusive modes.

**Allowlist mode is what runs today.** The original design assumed Google
Workspace SSO with no list to maintain. The audit of the live `.env` files
showed the team actually signs in as `@gmail.com`, and consumer accounts carry
no `hd` claim whatsoever, so the Workspace gate would have rejected all three
users permanently. `INTERNAL_EMAILS` is therefore the gate, checked server-side
in the `signIn` callback before any session is issued.

**Workspace mode is one env var away.** Set `WORKSPACE_DOMAIN` and access
requires a verified `hd` claim matching it. Not an `email.endsWith()` check:
that is a weaker and different assertion, since an address can be made to look
like a domain while `hd` is asserted by Google only for real Workspace accounts.

The two modes are exclusive rather than OR'd, deliberately. If a Workspace were
added and the Gmail allowlist stayed valid alongside it, the migration would
never actually complete — setting `WORKSPACE_DOMAIN` is the act that closes the
old door. `requireInternal()` re-asserts the same rule against claims carried on
the token, so tightening the config invalidates existing sessions on their next
request instead of letting them run out their natural life.

`requireInternal()` is called as the first statement of every internal route
handler and server action, and asserts `role === "internal"` explicitly rather
than settling for the existence of a session. `middleware.ts` still runs, but it
is defence in depth. The 15-unguarded-routes situation does not get to recur.

`auth.config.ts` / `auth.ts` are split because middleware runs on the edge, where
Prisma cannot. Anything touching the database goes in `auth.ts`. Adding a
DB-reading callback to `auth.config.ts` breaks middleware at runtime with an
opaque error.

### 4.2 Clients

A capability token, not a login.

1. Internal user clicks *Request feedback* on a project timeline. The server
   mints 32 random bytes, stores only the SHA-256, and emails
   `https://weft.thinkwarelabs.com/f/<raw>`.
2. `GET /f/<raw>` validates, sets a cookie, and **redirects to `/f`** — so the
   raw token leaves the address bar and stops leaking via `Referer`.
3. The cookie: `httpOnly`, `Secure`, `SameSite=Lax`, **`Path=/f`**, a 24-hour
   JWT signed with `CLIENT_TOKEN_SECRET`. Path scoping means the browser
   physically cannot send it to `/api/invoices`.

Link TTL 14 days, cookie TTL 24 hours. The token row is re-read on every request,
so revocation, contact deactivation and project archival take effect
immediately — and **the database wins over the cookie** if the two ever disagree
about scope, because the cookie is untrusted input.

**The rule that removes the bug class:** no client-facing route takes a resource
id. `/f` shows the project; `POST /api/client/feedback` submits. The project is
read from the cookie. There is no id to tamper with, so there is no IDOR.

Client reads use an allowlist (`kind: { in: ['feedback','milestone'] }`) rather
than excluding internal kinds. A new entry kind must be opted in, not remembered.

### 4.3 Tests that gate the client surface shipping

1. Cookie for project A returns nothing from project B, on every client route.
2. Client cookie alone → 401 on every internal route, including the PDF route.
3. Internal session alone → 401 on every client route.
4. Expired, revoked, tampered, and unknown tokens → 401 each.
5. Contact deactivated mid-session → next request 401.
6. `npm run lint` passes (the ESLint zones are a build-level control).

## 5. Build sequence

Each increment is independently shippable and revertible. `invoice.thinkwarelabs.com`
stays live and untouched throughout, and keeps ownership of invoice-number
allocation until Step 2 cuts over.

| # | Increment | Days |
|---|---|---|
| 0 | Fork, schema, auth foundation, lint zones, conventions | 3 |
| 1 | Workspace SSO + `requireInternal()` + AppShell | 2 |
| 2 | **Invoicing** — port money/gst/pdf/validation, Prisma data layer, cut over, 301 | 5 |
| 3 | Clients, Projects, onboarding checklist | 3 |
| 4 | Timeline — internal notes only | 4 |
| 5 | Client feedback + capability tokens | 6 |
| 6 | Ideas + Vault (port `lib/drive.ts`, rebuild UI on the kit) | 4 |
| 7 | Financials, audit, polish | 3 |

~30 working days for one developer. This is not faster than migrating the old
apps would have been — the saving from having nothing to migrate is spent on
getting the schema right. What it buys is a system without the debt.

The order holds one property throughout: **no externally reachable surface exists
until Step 5**, by which point `requireInternal()` has been mandatory for four
steps and the timeline schema has been in real use for two weeks.

### Cutover notes for Step 2

- Two systems must never both allocate `TWL-####`. The old app owns numbering
  until cutover; at cutover, read its `next_invoice_number` and seed Weft with
  that value. Do not seed it at the start of the build.
- The existing invoice (and any issued during the build) is re-keyed as
  structured data, not imported as a PDF — the design regenerates PDFs from data
  and never stores files. Finalize it, then diff the regenerated output against
  the PDF actually sent. That doubles as the first real test of the ported
  renderer. Keep the original in the Drive vault as an archive.

## 6. Out of scope

- **No storage for client credentials, `.env` values, or API keys.** A dedicated
  secrets manager handles that separately. Weft may link to where a secret
  lives; it must never hold one.
- **WeDose** is independent — own brand, own infrastructure, no relationship to
  this platform.
- **Clients never see invoices.** Today that's free, since Feedback is their only
  surface. If it ever changes, it is an architecture decision and this document
  is where to start.
