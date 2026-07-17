import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase'

// Public keep-alive endpoint for uptime monitors (e.g. UptimeRobot). A free-tier
// Supabase project pauses after a stretch of inactivity, so a scheduled call
// here touches the database to keep it awake.
//
// The database is only queried when the caller presents the shared secret via
// ?key=. Any request WITHOUT the correct key skips the database entirely and
// still returns { success: true } — so random bots and scanners can never make
// the endpoint do real work, and the response looks identical either way.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Touching every table doubles as a light "are the tables still there" check.
// Missing tables just error and are ignored — the endpoint always succeeds.
const TABLES = ['business_profile', 'clients', 'invoices', 'invoice_items', 'expenses', 'audit_logs']

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key')
  const secret = process.env.HEALTHCHECK_KEY

  if (secret && key === secret) {
    // A real select (not a head-count) forces an actual query to Postgres, which
    // is what keeps the project active. Errors are swallowed on purpose.
    await Promise.allSettled(TABLES.map((t) => db.from(t).select('id').limit(1)))
  }

  return NextResponse.json({ success: true })
}
