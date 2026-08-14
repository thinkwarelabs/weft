import { NextResponse } from 'next/server'
import { z } from 'zod'
import { submitClientFeedback } from '@/lib/client-scope'
import { ClientUnauthorizedError, CLIENT_COOKIE_NAME } from '@/lib/auth/client-token'

export const runtime = 'nodejs'

// The client's only write endpoint, and it lives UNDER /f deliberately.
//
// The session cookie is Path=/f, which is what stops the browser ever attaching
// it to /api/invoices. The corollary is that anything the client must POST to
// has to sit inside that path too — an endpoint at /api/client/feedback would
// simply never receive the cookie, and every submission would 401.
//
// So the invariant is: THE CLIENT SURFACE IS EXACTLY THE /f SUBTREE. Page,
// token exchange, and this handler. If you add another client endpoint, it goes
// here, not under /api.
//
// Note the body: text, and optionally which open request it answers. No
// projectId, no contactId — those come from the cookie inside
// submitClientFeedback, and a client cannot influence them.
const input = z.object({
  body: z.string().trim().min(1, 'Please write something').max(10_000, 'That is too long'),
  requestId: z.string().min(1).optional(),
})

export async function POST(req: Request) {
  try {
    const parsed = input.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 },
      )
    }

    const entry = await submitClientFeedback(parsed.data)
    return NextResponse.json({ ok: true, id: entry.id }, { status: 201 })
  } catch (error) {
    if (error instanceof ClientUnauthorizedError) {
      // Clear the dead cookie so the browser stops sending it.
      const res = NextResponse.json({ error: error.message }, { status: 401 })
      res.cookies.set(CLIENT_COOKIE_NAME, '', { path: '/f', maxAge: 0 })
      return res
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    throw error
  }
}
