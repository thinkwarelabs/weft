import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { requireInternal, toResponse } from '@/lib/auth/internal'
import { MAX_BODY, MAX_TITLE } from '@/lib/ideas'

// Ported from Trove. Note what is absent: there is no PATCH here and no
// /api/ideas/[id] PATCH either. Ideas are append-only, and refinement happens
// in comments. Do not add an update path.

const ideaInput = z.object({
  title: z.string().trim().min(1, 'An idea needs a title').max(MAX_TITLE),
  body: z.string().trim().min(1, 'An idea needs a body').max(MAX_BODY),
  // Optional TAG, not a scope. Ideas are team space and never appear on any
  // client surface, tagged or not.
  project_id: z.string().min(1).optional().nullable(),
})

export async function GET(req: Request) {
  try {
    await requireInternal()

    const q = new URL(req.url).searchParams.get('q')?.trim()

    const ideas = await db.idea.findMany({
      where: q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { body: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        _count: { select: { comments: true } },
      },
    })

    return NextResponse.json({
      ideas: ideas.map((i) => ({
        id: i.id,
        title: i.title,
        body: i.body,
        created_at: i.createdAt.toISOString(),
        author: { id: i.author.id, name: i.author.name ?? i.author.email },
        project: i.project,
        comment_count: i._count.comments,
      })),
    })
  } catch (error) {
    return toResponse(error)
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireInternal()

    const parsed = ideaInput.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }
    const { title, body, project_id } = parsed.data

    if (project_id) {
      const project = await db.project.findUnique({
        where: { id: project_id },
        select: { id: true },
      })
      if (!project) {
        return NextResponse.json({ error: 'That project does not exist.' }, { status: 400 })
      }
    }

    const idea = await db.idea.create({
      data: { title, body, authorId: actor.id, projectId: project_id ?? null },
      select: { id: true },
    })

    await logAudit({
      action: 'idea.create',
      entityType: 'idea',
      entityId: idea.id,
      metadata: { title },
    })

    return NextResponse.json({ id: idea.id }, { status: 201 })
  } catch (error) {
    return toResponse(error)
  }
}
