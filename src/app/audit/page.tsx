import { AppShell } from '@/components/AppShell'
import { AuditLog } from '@/components/audit/AuditLog'
import { auth } from '@/auth'
import { isAuditAdmin } from '@/lib/allowlist'

export default async function AuditPage() {
  const session = await auth()
  const allowed = isAuditAdmin(session?.user?.email)

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
      <p className="mt-1 text-sm text-zinc-500">A trace of who did what across the platform.</p>
      <div className="mt-8">
        {allowed ? (
          <AuditLog />
        ) : (
          <p className="text-sm text-zinc-500">
            You don&apos;t have access to the audit log. Ask an administrator to add you to{' '}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">AUDIT_ADMINS</code>.
          </p>
        )}
      </div>
    </AppShell>
  )
}
