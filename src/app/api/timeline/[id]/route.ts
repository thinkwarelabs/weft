import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { requireInternal, toResponse } from '@/lib/auth/internal'
import { canDeleteEntry } from '@/lib/timeline'

type Ctx = { params: Promise<{ id: string }> }

// There is NO update endpoint for a timeline entry, and that absence is the
// point — a log you can rewrite is not a log. Deletion exists only to undo a
// mistake made moments ago: own entry, internal, under 15 minutes old. The rule
// lives in lib/timeline.ts and is enforced here, server-side.
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const actor = await requireInternal()
    const { id } = await params

    const entry = await db.timelineEntry.findUnique({
      where: { id },
      select: {
        id: true,
        kind: true,
        projectId: true,
        authorType: true,
        authorUserId: true,
        createdAt: true,
      },
    })
    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })

    if (!canDeleteEntry(entry, actor.id)) {
      // Deliberately one message for every refusal — not yours, too old, or
      // client-authored. Distinguishing them would tell a caller what exists.
      return NextResponse.json(
        { error: 'You can only remove your own note, within 15 minutes of writing it.' },
        { status: 403 },
      )
    }

    await db.timelineEntry.delete({ where: { id } })

    await logAudit({
      action: 'timeline.delete',
      entityType: 'timeline_entry',
      entityId: id,
      metadata: { kind: entry.kind, projectId: entry.projectId },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return toResponse(error)
  }
}
