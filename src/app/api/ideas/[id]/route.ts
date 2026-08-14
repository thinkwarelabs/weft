import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { requireInternal, toResponse } from '@/lib/auth/internal'
import { canDeleteIdea } from '@/lib/ideas'

type Ctx = { params: Promise<{ id: string }> }

// GET and DELETE only. There is deliberately no PATCH — see lib/ideas.ts.
export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireInternal()
    const { id } = await params

    const idea = await db.idea.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, name: true, email: true } } },
        },
      },
    })
    if (!idea) return NextResponse.json({ error: 'Idea not found' }, { status: 404 })

    return NextResponse.json({
      idea: {
        id: idea.id,
        title: idea.title,
        body: idea.body,
        created_at: idea.createdAt.toISOString(),
        author: { id: idea.author.id, name: idea.author.name ?? idea.author.email },
        project: idea.project,
      },
      comments: idea.comments.map((c) => ({
        id: c.id,
        parent_id: c.parentId,
        body: c.body ?? '',
        created_at: c.createdAt.toISOString(),
        author: { id: c.author.id, name: c.author.name ?? c.author.email },
      })),
    })
  } catch (error) {
    return toResponse(error)
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const actor = await requireInternal()
    const { id } = await params

    const idea = await db.idea.findUnique({
      where: { id },
      select: { id: true, authorId: true, createdAt: true, title: true },
    })
    if (!idea) return NextResponse.json({ error: 'Idea not found' }, { status: 404 })

    if (!canDeleteIdea(idea, actor.id)) {
      return NextResponse.json(
        { error: 'You can only delete your own idea, within 15 minutes of posting it.' },
        { status: 403 },
      )
    }

    // Comments cascade via the schema FK.
    await db.idea.delete({ where: { id } })

    await logAudit({
      action: 'idea.delete',
      entityType: 'idea',
      entityId: id,
      metadata: { title: idea.title },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return toResponse(error)
  }
}
