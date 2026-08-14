# Weft

ThinkWare Labs' internal platform. One Next.js app, one Postgres database,
three internal users, and clients who touch exactly one surface.

Merges the former `invoice` and `trove` apps and adds a client timeline.
`invoice.thinkwarelabs.com` and `trove.thinkwarelabs.com` become 301 redirects
once each module has moved.

Full reasoning: `docs/weft-architecture.md`. This file is the short version —
the rules, not the argument.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Database | Supabase Postgres — single source of truth |
| ORM | Prisma 7 (driver adapter, `@prisma/adapter-pg`) |
| Internal auth | Auth.js v5, Google Workspace SSO, **JWT** sessions |
| Client auth | Purpose-built capability tokens — **not** Auth.js |
| Email | Resend (client links), SMTP/nodemailer (internal notifications) |
| File storage | Google Drive via OAuth, owner's account |
| Search | Postgres FTS (`tsvector` generated columns + GIN) |
| Hosting | Vercel |

## The two trust boundaries

This is the thing most likely to go wrong, so it gets the most rules.

### Internal — the three of us

Google sign-in, with the access rule in one pure, tested place:
`src/lib/auth/identity.ts`. Two exclusive modes, chosen by config:

- **Allowlist mode (current).** ThinkWare Labs is on consumer Gmail accounts,
  which carry no `hd` claim at all. `INTERNAL_EMAILS` is the gate, checked
  server-side in the `signIn` callback *before* a session is issued.
- **Workspace mode (later).** Set `WORKSPACE_DOMAIN` and access requires a
  verified `hd` claim matching it. Never substitute an
  `email.endsWith("@thinkwarelabs.com")` check — that is not the same
  assertion, and an address can be made to look like anything.

The modes are exclusive, not OR'd: setting `WORKSPACE_DOMAIN` is what closes
the door on the old Gmail accounts. If they were OR'd the migration would never
finish. `requireInternal()` re-asserts the same rule on every request, so
removing someone from `INTERNAL_EMAILS` takes effect immediately rather than
whenever their JWT happens to expire.

- **Every internal route handler and server action calls `requireInternal()`
  from `@/lib/auth/internal` as its first statement.** No exceptions. If a route
  feels like it doesn't need one, it does.
- `middleware.ts` is **defence in depth, not the control.** The predecessor app
  guarded 15 of 17 API routes with middleware alone; that was only ever safe
  because every session belonged to a trusted person. Do not rely on it.
- Authorization asserts `session.user.role === "internal"`. The existence of a
  session is not the question being asked.
- `AUDIT_ADMINS` is a separate, narrower capability — use `requireAuditAdmin()`.

### Clients — scoped, expiring, one project

Clients have no accounts on our domain and never will. They get a capability
token: *"the holder may leave feedback on project X until <date>"*.

- **No client-facing route takes a resource id.** Not in the path, not in the
  query, not in the body. The project comes from the verified cookie and nowhere
  else. No id in the URL means no IDOR to get wrong. This rule is the single
  most important one in the repo.
- **All client reads and writes go through named functions in
  `@/lib/client-scope`.** Client routes never hold a Prisma client. A scoped
  client still exposes `findMany` on every model; a fixed set of functions
  cannot be pointed at the wrong table.
- Filter client reads by an **allowlist** of what they may see
  (`kind: { in: [...] }`), never a denylist of what they may not. A new entry
  kind must be opted in explicitly rather than exposed by default.
- The raw token is never stored, never logged, and never survives past the
  one-time exchange redirect. Only its SHA-256 is persisted.
- The cookie is `Path=/f`, so the browser cannot send it to `/api/invoices`.
- `CLIENT_TOKEN_SECRET` is **not** `AUTH_SECRET`. Boot fails if they match.
- The token row is re-read on **every** request, so revoking a link,
  deactivating a contact, or archiving a project takes effect immediately.
- ESLint zones in `eslint.config.mjs` make violations build failures. If one
  fires, do not add `eslint-disable` — the import means the design has drifted.

## Data model rules

- `Project` is the unit of scope. `projectId` is **never nullable** anywhere it
  appears. A nullable scope key is one bad query away from meaning "all".
- `Invoice.projectId` is required. If a client has no project, the UI creates a
  default one — it does not write a null.
- `Client.billingEmail` (where invoices go) and `ClientContact` (humans who can
  author feedback) are different things. Never conflate them.
- Onboarding is a checklist on **Project**, not Client. Clients hire us twice.
- `TimelineEntry` holds internal notes *and* client feedback — one object, two
  authors. Exactly one of `authorUserId`/`authorContactId` is set, enforced by
  the `timeline_author_exclusive` CHECK constraint in the database, not just in
  application code.
- `Idea.projectId` is an optional **tag**, not a scope. Ideas are team space and
  are never exposed on any client surface, tagged or not.
- Invoice `businessSnapshot`/`clientSnapshot` are frozen at finalize so a
  regenerated PDF never drifts. Never backfill them.
- Never increment `next_invoice_number` from application code. Call
  `allocate_invoice_number()` via `$queryRaw` — a read-then-write in JS
  reintroduces the race the function exists to avoid.
- Money is `Decimal(14,2)` in Postgres. Convert at the data-access boundary with
  `num()`/`nums()` from `@/lib/db` so `money.ts` and `gst.ts` (26 tests, ported
  unchanged) keep working in `number`. Never mix a Decimal and a number in
  arithmetic.

## Out of scope — do not build

- **No storage for client credentials, `.env` values, or API keys.** A dedicated
  secrets manager handles that. The platform may link to where a secret lives;
  it must never hold one. Do not design storage for it.
- **WeDose** is an independent product with its own brand and infrastructure. It
  has no relationship to this platform.
- Clients never see invoices. If that changes, it is an architecture decision,
  not a feature — revisit `docs/weft-architecture.md` first.

## Migrations

- Prisma owns the schema. `npm run db:migrate` in dev, `db:deploy` in CI.
- Raw SQL Prisma can't express (CHECK constraints, `allocate_invoice_number()`,
  `tsvector` generated columns, RLS) lives in `prisma/raw/001_init_extras.sql`
  and is appended by hand to the generated init migration.
- **Never edit an applied migration.** Write a new one.

### Always use `--create-only`, then read the SQL

```bash
npx prisma migrate dev --create-only --name <what_changed>
#   ...read prisma/migrations/*_<name>/migration.sql, edit if needed...
npx prisma migrate deploy
```

Never let `migrate dev` generate and apply in one step. Prisma cannot represent
`GENERATED ALWAYS AS ... STORED`, so it reads the five `search_vector`
generation expressions as column defaults and adds this to **every** migration
it writes:

```sql
ALTER TABLE "comments"          ALTER COLUMN "search_vector" DROP DEFAULT;
ALTER TABLE "files"             ALTER COLUMN "search_vector" DROP DEFAULT;
ALTER TABLE "ideas"             ALTER COLUMN "search_vector" DROP DEFAULT;
ALTER TABLE "timeline_entries"  ALTER COLUMN "search_vector" DROP DEFAULT;
ALTER TABLE "voice_notes"       ALTER COLUMN "search_vector" DROP DEFAULT;
```

**Delete those lines before applying.** They are noise, not a change — the
columns are generated, not defaulted. (`DROP DEFAULT` is harmless; `DROP
EXPRESSION` would not be, so if you ever see *that*, stop and think.)

Removing `searchVector` from `schema.prisma` to silence this is worse: the
columns exist in the shadow database, so Prisma would generate `DROP COLUMN`
instead. `Unsupported("tsvector")?` plus this rule is the correct trade.
- Migrations need `DIRECT_URL` (session pooler, port 5432). DDL cannot run
  through the transaction pooler.

## Conventions

- `src/lib/` holds pure logic with unit tests; I/O lives in route handlers and
  `src/lib/db.ts`. Keep that separation — it is why the port was cheap.
- Validate every write with a zod schema in `src/lib/validation.ts`.
- Audit every write with `logAudit()`, after the operation succeeds. Logging
  must never roll back the thing it logs.
- Enforce security and business rules **server-side**, never only in the UI.
- Run `npm run lint && npx tsc --noEmit && npm test` before every commit.

**Lint must stay green.** The import zones in `eslint.config.mjs` are a security
control, not a style preference — they are what stops client-facing code from
importing the invoicing modules. A permanently red lint run is one nobody reads,
and that is how a real boundary violation slips through unnoticed. If something
unrelated starts failing, fix it or downgrade it explicitly with a comment
saying why; never leave the run red.

### Known debt

- Four ported components call `setState` inside an effect
  (`react-hooks/set-state-in-effect`, downgraded to a warning). The fix is to
  remount the modals with a `key` prop instead of syncing state. Clean up when
  those components are next touched, then restore the rule to `error`.
- The API returns **snake_case** JSON (`invoice.invoice_number`) while Prisma
  models are camelCase. `src/lib/serialize.ts` maps between them and is the only
  place `Decimal` becomes `number` and `Date` becomes a string. This preserved
  the contract the UI components were written against, so the Prisma port
  touched no frontend code. If a component renders `[object Object]` or `NaN`,
  a field is missing from a mapper.
- `src/lib/types.ts` holds the API DTO shapes. It is the response contract, not
  the database schema — Prisma owns the latter.
