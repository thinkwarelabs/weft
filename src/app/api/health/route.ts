import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { db } from '@/lib/db'
import { env } from '@/lib/env'

// Public keep-alive for uptime monitors. A free-tier Supabase project pauses
// after a stretch of inactivity, and this is now the database everything
// depends on — point an uptime monitor here on a schedule.
//
// Listed in middleware's PUBLIC_PREFIXES, so it is the one route besides
// /api/auth that runs without a session. That is deliberate and is why the
// database is only touched when the caller presents the shared secret: without
// it, scanners and bots can never make the endpoint do work. The response is
// identical either way, so the key is not discoverable by comparing outputs.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function secretMatches(provided: string | null): boolean {
  const expected = env.HEALTHCHECK_KEY
  if (!expected || !provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  // Constant-time compare so response timing can't be used to guess the key
  // character by character.
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key')

  if (secretMatches(key)) {
    try {
      // A real query, so Postgres actually does work — that is what keeps the
      // project active. Errors are swallowed on purpose: this endpoint reports
      // reachability to a monitor, not database health to a human.
      await db.$queryRaw`SELECT 1`
    } catch (e) {
      console.error('health: keep-alive query failed', e)
    }
  }

  return NextResponse.json({ success: true })
}
