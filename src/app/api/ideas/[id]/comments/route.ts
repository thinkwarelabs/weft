import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { requireInternal, toResponse } from '@/lib/auth/internal'
import { MAX_COMMENT, isValidReplyTarget } from '@/lib/ideas'

type Ctx = { params: Promise<{ id: string }> }

const commentInput = z.object({
  body: z.string().trim().min(1, 'Write something').max(MAX_COMMENT),
  parent_id: z.string().min(1).optional().nullable(),
})

// Comments are where an idea gets refined, since the idea itself is immutable.
export async function POST(req: Request, { params }: Ctx) {
  try {
    const actor = await requireInternal()
    const { id: ideaId } = await params

    const parsed = commentInput.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }
    const { body, parent_id } = parsed.data

    const idea = await db.idea.findUnique({ where: { id: ideaId }, select: { id: true } })
    if (!idea) return NextResponse.json({ error: 'Idea not found' }, { status: 404 })

    // A reply's parent must live on THIS idea — otherwise a crafted parent_id
    // would graft a thread onto someone else's idea.
    if (parent_id) {
      const parent = await db.comment.findUnique({
        where: { id: parent_id },
        select: { ideaId: true },
      })
      if (!isValidReplyTarget(parent, ideaId)) {
        return NextResponse.json(
          { error: 'That reply target does not belong to this idea.' },
          { status: 400 },
        )
      }
    }

    const comment = await db.comment.create({
      data: { body, ideaId, authorId: actor.id, parentId: parent_id ?? null },
      select: { id: true },
    })

    await logAudit({
      action: 'idea.comment',
      entityType: 'idea',
      entityId: ideaId,
      metadata: { commentId: comment.id, isReply: Boolean(parent_id) },
    })

    return NextResponse.json({ id: comment.id }, { status: 201 })
  } catch (error) {
    return toResponse(error)
  }
}
