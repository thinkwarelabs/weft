# Deploying Weft and retiring the Invoice app

Do these in order. Steps 1–4 change nothing for anyone; the old app keeps
running and keeps issuing invoice numbers until step 6.

The one rule that matters: **only one system allocates invoice numbers at a
time.** Everything below is arranged so that stays true.

---

## 1. Google OAuth — add the production callback

Weft currently borrows the Invoice app's OAuth client, which only knows about
`localhost`. Without this nobody can sign in at all.

Google Cloud Console → Credentials → the OAuth 2.0 Client Weft uses:

- **Authorised JavaScript origins**: add `https://weft.thinkwarelabs.com`
- **Authorised redirect URIs**: add
  `https://weft.thinkwarelabs.com/api/auth/callback/google`

Keep the `localhost` entries — you still need them for development.

> Worth creating a dedicated OAuth client for Weft at some point. Sharing one
> with the Invoice app is fine while both exist, but it means retiring Invoice
> later can't include deleting its client.

## 2. Vercel project

Import `thinkwarelabs/weft`. Framework preset: Next.js. Nothing to override —
`vercel.json` already pins functions to `bom1` (Mumbai) so they sit next to the
database rather than crossing the planet on every query.

## 3. Environment variables

Set these for **Production** (and Preview, if you want previews to work).
Copy from `.env.example`; take values from your local `.env` EXCEPT the two
marked "generate fresh".

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase transaction pooler, port **6543**, `?pgbouncer=true` |
| `DIRECT_URL` | Supabase session pooler, port **5432** — needed by `migrate deploy` |
| `AUTH_SECRET` | **generate fresh** — `openssl rand -base64 32` |
| `CLIENT_TOKEN_SECRET` | **generate fresh**, and different from `AUTH_SECRET` (boot fails if they match) |
| `AUTH_URL` | `https://weft.thinkwarelabs.com` |
| `APP_URL` | `https://weft.thinkwarelabs.com` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | same as local |
| `WORKSPACE_DOMAIN` | leave **empty** — you're on Gmail, allowlist mode |
| `INTERNAL_EMAILS` | the three Gmail addresses |
| `AUDIT_ADMINS` | `shivxmsharma@gmail.com` |
| `HEALTHCHECK_KEY` | `openssl rand -hex 24` |
| `EMAIL_*` | same as local (invoice finalize notifications) |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | needed only for client feedback links — see step 7 |

Development secrets should not become production secrets. The two "generate
fresh" values are the ones worth caring about: your local `.env` has been on
disk across machines.

## 4. Deploy

`npm run build` now runs `prisma migrate deploy` before `next build`, so
migrations apply on every deployment. The database is already migrated, so this
first deploy finds nothing pending — the point is that future schema changes
ship with the code that needs them.

After it deploys, sign in. Everything should work except client feedback email.

## 5. Keep-alive

Point an uptime monitor (UptimeRobot or similar) at:

```
https://weft.thinkwarelabs.com/api/health?key=<HEALTHCHECK_KEY>
```

Every 6 hours is plenty. A free-tier Supabase project pauses after about a week
of inactivity, and this is now the database everything depends on.

---

## 6. Cutover — the only step with a wrong order

**Stop issuing invoices from the old app before starting.** From here until the
last line, don't finalize anything anywhere.

**6a. Read the old sequence.** In the OLD Supabase project's SQL editor:

```sql
select invoice_prefix, next_invoice_number from business_profile where id = 1;
```

Write the number down.

**6b. Re-key the existing invoices.** In Weft: create the client, create a
project, create the invoice with the same line items, dates and tax rate.
Finalize it. Then compare the regenerated PDF against the one you actually sent
— same totals, same GST split, same number. That comparison is the real test of
the ported renderer, and it's why we re-keyed rather than importing a PDF blob.

Repeat for anything issued while Weft was being built.

**6c. Seed the sequence.** In WEFT's Supabase SQL editor:

```sql
-- Set to the value read in 6a. If you finalized N invoices in 6b, Weft's
-- counter has already advanced N times — this overwrites it to the truth.
update business_profile set next_invoice_number = <value from 6a> where id = 1;

-- Verify
select invoice_prefix, next_invoice_number from business_profile where id = 1;
```

**6d. Sanity check.** Create a throwaway draft, finalize it, confirm it gets the
number you expect, then void it. Voiding keeps the number — gaps in the sequence
are correct and auditable, and the number is never reused.

**6e. Redirect.** Point `invoice.thinkwarelabs.com` at Weft with a 301 to
`/`. Keep the old Vercel project and its database for now — retiring them is a
separate decision, and the data is your only record of what was issued before
cutover.

---

## 7. Client feedback links (can wait)

`RESEND_FROM_EMAIL` still points at `trove@mail.wedose.in`, a WeDose domain.
Before sending a client anything:

1. Add `thinkwarelabs.com` (or `mail.thinkwarelabs.com`) as a domain in Resend
2. Add the DKIM/SPF records it gives you to your DNS
3. Wait for verification — hours, not minutes
4. Set `RESEND_FROM_EMAIL` to e.g. `Thinkware Labs <hello@thinkwarelabs.com>`

Until then, requesting feedback fails cleanly: the route revokes the token it
just minted, so you're never left with a live credential nobody received.

---

## Rollback

Nothing here is one-way except 6c, and that's a single `update`.

- **Bad deploy** — Vercel → Deployments → promote the previous one.
- **Cutover went wrong** — the old app and its database are untouched. Remove
  the 301 and carry on there. Fix Weft, redo step 6.
- **Someone can't sign in** — check `INTERNAL_EMAILS`, then the OAuth redirect
  URI. Those are the only two gates.
