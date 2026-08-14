import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { timelineEntryInput } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { requireInternal, toResponse } from '@/lib/auth/internal'
import { serializeTimelineEntry } from '@/lib/serialize'

type Ctx = { params: Promise<{ id: string }> }

// The INTERNAL view of a project's timeline: everything, both authors.
// The client view is a different code path entirely — lib/client-scope.ts —
// which filters by an allowlist of kinds and never selects an internal author.
const AUTHOR_SELECT = {
  authorUser: { select: { id: true, name: true, email: true } },
  authorContact: { select: { id: true, name: true } },
} as const

export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireInternal()
    const { id } = await params

    const project = await db.project.findUnique({ where: { id }, select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const entries = await db.timelineEntry.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
      include: AUTHOR_SELECT,
    })

    return NextResponse.json({ entries: entries.map(serializeTimelineEntry) })
  } catch (error) {
    return toResponse(error)
  }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const actor = await requireInternal()
    const { id } = await params

    const parsed = timelineEntryInput.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }
    const { kind, body } = parsed.data

    const project = await db.project.findUnique({ where: { id }, select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    // authorContactId is deliberately left unset. The DB CHECK constraint
    // timeline_author_exclusive rejects a row carrying both, so an internal
    // note can never be mistaken for client feedback even if this code is wrong.
    const entry = await db.timelineEntry.create({
      data: {
        projectId: id,
        kind,
        authorType: 'internal',
        authorUserId: actor.id,
        body,
      },
      include: AUTHOR_SELECT,
    })

    await logAudit({
      action: 'timeline.create',
      entityType: 'timeline_entry',
      entityId: entry.id,
      metadata: { kind, projectId: id },
    })

    return NextResponse.json({ entry: serializeTimelineEntry(entry) }, { status: 201 })
  } catch (error) {
    return toResponse(error)
  }
}
