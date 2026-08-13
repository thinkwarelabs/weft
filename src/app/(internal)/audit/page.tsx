import { AuditLog } from '@/components/audit/AuditLog'
import { requireInternal } from '@/lib/auth/internal'
import { isAuditAdmin } from '@/lib/env'

// AUDIT_ADMINS is a narrower capability than "is internal", so it is checked
// here as well as in /api/audit. This one only decides what to render; the API
// route is what actually protects the data. Never rely on this page's check.
export default async function AuditPage() {
  const actor = await requireInternal()
  const allowed = isAuditAdmin(actor.email)

  return (
    <>
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
    </>
  )
}
