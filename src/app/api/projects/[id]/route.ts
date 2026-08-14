import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { projectPatchInput } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { requireInternal, toResponse } from '@/lib/auth/internal'
import { serializeClient, serializeProject } from '@/lib/serialize'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireInternal()
    const { id } = await params

    const project = await db.project.findUnique({
      where: { id },
      include: {
        client: true,
        _count: { select: { invoices: true, entries: true, tokens: true } },
      },
    })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    return NextResponse.json({
      project: serializeProject(project),
      client: serializeClient(project.client),
      counts: {
        invoices: project._count.invoices,
        entries: project._count.entries,
        tokens: project._count.tokens,
      },
    })
  } catch (error) {
    return toResponse(error)
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const actor = await requireInternal()
    const { id } = await params

    const body = await req.json()
    const parsed = projectPatchInput.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }
    const d = parsed.data

    const existing = await db.project.findUnique({
      where: { id },
      select: { id: true, name: true, status: true, archivedAt: true },
    })
    if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    // clientId is deliberately absent from projectPatchInput. Moving a project
    // to another client would silently re-scope every invoice, timeline entry
    // and access token attached to it — including live client feedback links.
    const data: Record<string, unknown> = {}
    if (d.name !== undefined) data.name = d.name
    if (d.status !== undefined) data.status = d.status
    if (d.archived !== undefined) data.archivedAt = d.archived ? new Date() : null

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const statusChanged = d.status !== undefined && d.status !== existing.status

    // A status change writes itself onto the timeline, in the same transaction
    // as the change. The project's own history is part of the record, not
    // something anyone has to remember to note down.
    const project = await db.$transaction(async (tx) => {
      const updated = await tx.project.update({ where: { id }, data })

      if (statusChanged) {
        await tx.timelineEntry.create({
          data: {
            projectId: id,
            kind: 'status_change',
            authorType: 'internal',
            authorUserId: actor.id,
            body: `Status changed from ${existing.status} to ${d.status}.`,
          },
        })
      }

      return updated
    })

    await logAudit({
      action:
        d.archived === true
          ? 'project.archive'
          : d.archived === false
            ? 'project.unarchive'
            : 'project.update',
      entityType: 'project',
      entityId: id,
      metadata: { name: project.name, status: project.status },
    })

    return NextResponse.json({ project: serializeProject(project) })
  } catch (error) {
    return toResponse(error)
  }
}
