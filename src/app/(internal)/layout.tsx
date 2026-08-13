import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { requireInternal, UnauthorizedError } from '@/lib/auth/internal'
import { isAuditAdmin } from '@/lib/env'
import { auth } from '@/auth'

// The guard for every internal page.
//
// This runs in a Node server component, so it can re-read the DB-backed rule
// rather than relying on the edge middleware's cheaper check. Middleware still
// runs first and bounces the obvious cases; this is the one that decides.
//
// Pages inside this group must NOT wrap themselves in <AppShell> — the shell is
// rendered once, here, so the guard and the chrome can never drift apart. A
// page that renders without going through this layout is a page that renders
// without an authorization check.
export default async function InternalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let actor
  try {
    actor = await requireInternal()
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/signin')
    throw error
  }

  // requireInternal deliberately returns only what a write needs to attribute
  // itself. The avatar is cosmetic, so it comes from the session separately
  // rather than widening that contract.
  const session = await auth()

  return (
    <AppShell
      actor={{
        name: actor.name,
        email: actor.email,
        image: session?.user?.image ?? null,
      }}
      showAudit={isAuditAdmin(actor.email)}
    >
      {children}
    </AppShell>
  )
}
