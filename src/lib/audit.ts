import 'server-only'
import type { ActorType } from '@/generated/prisma/client'

export type AuditEntityType =
  | 'invoice'
  | 'client'
  | 'expense'
  | 'settings'
  | 'project'
  | 'contact'
  | 'timeline_entry'
  | 'client_token'
  | 'idea'
  | 'file'

export interface AuditInput {
  action: string // e.g. 'invoice.finalize', 'client.create'
  entityType?: AuditEntityType
  entityId?: string | number | null
  metadata?: Record<string, unknown>
  // Which side of the trust boundary acted. Clients write audit rows too now
  // (token exchange, feedback submission), so this is recorded explicitly
  // rather than inferred from whether actorEmail happens to be set.
  actorType?: ActorType
  // Override the actor/ip instead of reading them from the request context.
  // Used by tests; production callers omit these.
  actorEmail?: string | null
  ip?: string | null
}

// Build the row that gets written, resolving actor + ip from the request when
// not supplied. Pure and side-effect free so it can be unit-tested directly —
// keep it free of heavy/server-only imports.
export function buildAuditRow(
  input: AuditInput,
  ctx: { actorEmail?: string | null; ip?: string | null } = {},
) {
  return {
    actorType: input.actorType ?? ('internal' as ActorType),
    actorEmail: input.actorEmail ?? ctx.actorEmail ?? null,
    action: input.action,
    entityType: input.entityType ?? null,
    entityId: input.entityId != null ? String(input.entityId) : null,
    metadata: (input.metadata ?? null) as never,
    ip: input.ip ?? ctx.ip ?? null,
  }
}

// Read a best-effort client IP from the standard proxy headers.
async function requestIp(): Promise<string | null> {
  try {
    const { headers } = await import('next/headers')
    const h = await headers()
    const forwarded = h.get('x-forwarded-for')
    if (forwarded) return forwarded.split(',')[0]!.trim()
    return h.get('x-real-ip')
  } catch {
    return null
  }
}

// Record an audit entry. Fire-and-forget: a logging failure must NEVER break or
// roll back the operation being logged, so everything here is wrapped and any
// error is swallowed after being logged to the server console. Call it AFTER
// the underlying operation has succeeded. Server deps are imported lazily so the
// pure helpers above stay importable in a plain test environment.
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    const [{ auth }, { db }, ip] = await Promise.all([
      import('@/auth'),
      import('@/lib/db'),
      requestIp(),
    ])
    // A client-authored action has no NextAuth session; don't attribute one.
    const session = input.actorType === 'client' ? null : await auth()
    const row = buildAuditRow(input, {
      actorEmail: session?.user?.email ?? null,
      ip,
    })
    await db.auditLog.create({ data: row })
  } catch (e) {
    console.error(`audit: failed to write '${input.action}':`, e)
  }
}
