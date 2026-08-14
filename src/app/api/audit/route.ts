import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pageCount, parsePagination } from '@/lib/pagination'
import { requireAuditAdmin, toResponse } from '@/lib/auth/internal'
import type { Prisma } from '@/generated/prisma/client'

// AUDIT_ADMINS is a narrower capability than "is internal" — every teammate can
// use the app, but only admins can read the trail of who did what. This route
// is the control; the /audit page's check only decides what to render.
export async function GET(req: Request) {
  try {
    await requireAuditAdmin()

    const params = new URL(req.url).searchParams
    const { page, pageSize, from } = parsePagination(params)

    const actor = params.get('actor')?.trim()
    const action = params.get('action')?.trim()
    const entityType = params.get('entityType')?.trim()

    const where: Prisma.AuditLogWhereInput = {
      ...(actor ? { actorEmail: { contains: actor, mode: 'insensitive' } } : {}),
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
    }

    const [rows, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: from,
        take: pageSize,
      }),
      db.auditLog.count({ where }),
    ])

    return NextResponse.json({
      logs: rows.map((r) => ({
        id: r.id,
        created_at: r.createdAt.toISOString(),
        actor_type: r.actorType,
        actor_email: r.actorEmail,
        action: r.action,
        entity_type: r.entityType,
        entity_id: r.entityId,
        metadata: r.metadata,
        ip: r.ip,
      })),
      total,
      page,
      pageSize,
      pageCount: pageCount(total, pageSize),
    })
  } catch (error) {
    return toResponse(error)
  }
}
