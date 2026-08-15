import { NextResponse } from 'next/server'
import { exchangeToken, ClientUnauthorizedError } from '@/lib/auth/client-token'
import { logAudit } from '@/lib/audit'
import { env } from '@/lib/env'

export const runtime = 'nodejs'
// The token must never be cached, by us or by anything between us.
export const dynamic = 'force-dynamic'

// The ONE place a raw token appears in a URL.
//
// It is exchanged for a Path=/f cookie and then immediately redirected away, so
// the raw value leaves the address bar, the browser history entry, and the
// Referer header of every subsequent request. This is also the only client
// route that takes anything in its path — and what it takes is a credential,
// not a resource id, so there is nothing to enumerate.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  try {
    const claims = await exchangeToken(token)

    await logAudit({
      action: 'client_token.exchange',
      actorType: 'client',
      entityType: 'client_token',
      entityId: claims.tid,
      metadata: { projectId: claims.projectId, contactId: claims.contactId },
    })

    // env.APP_URL is validated at boot. A `?? 'http://localhost:3000'` fallback
    // here would send a real client to their own machine if the var were ever
    // missing in production — a silent failure instead of a loud one.
    return NextResponse.redirect(new URL('/f', env.APP_URL), { status: 303 })
  } catch (error) {
    if (error instanceof ClientUnauthorizedError) {
      // The reason is recorded for us; the visitor is told nothing that
      // distinguishes revoked from expired from never-existed.
      await logAudit({
        action: 'client_token.rejected',
        actorType: 'client',
        entityType: 'client_token',
        metadata: { decision: error.decision },
      })
      return NextResponse.redirect(new URL('/f/expired', env.APP_URL), { status: 303 })
    }
    throw error
  }
}
