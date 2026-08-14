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

    const [entries, requests] = await Promise.all([
      db.timelineEntry.findMany({
        where: { projectId: id },
        orderBy: { createdAt: 'desc' },
        include: AUTHOR_SELECT,
      }),
      // A feedback request is an event on this timeline — it just happens to
      // live in its own table because it also carries the token and the
      // recipient. Threading it here keeps the log readable as a conversation
      // without duplicating the prompt into a second place.
      db.feedbackRequest.findMany({
        where: { projectId: id },
        orderBy: { createdAt: 'desc' },
        include: {
          contact: { select: { id: true, name: true, email: true } },
          requestedBy: { select: { name: true, email: true } },
        },
      }),
    ])

    // An answered request owns its reply, so that reply must not ALSO appear at
    // the top level. Unsolicited feedback has no request and stays top-level.
    const answerIds = new Set(requests.map((r) => r.answerId).filter(Boolean) as string[])
    const byId = new Map(entries.map((e) => [e.id, e]))

    const items = [
      ...requests.map((r) => {
        const answer = r.answerId ? byId.get(r.answerId) : undefined
        return {
          id: r.id,
          kind: 'feedback_request' as const,
          body: r.prompt,
          author: {
            kind: 'internal' as const,
            name: r.requestedBy.name ?? r.requestedBy.email,
          },
          created_at: r.createdAt.toISOString(),
          sent_to: r.contact.name,
          answered_at: r.respondedAt?.toISOString() ?? null,
          replies: answer ? [serializeTimelineEntry(answer)] : [],
        }
      }),
      ...entries
        .filter((e) => !answerIds.has(e.id))
        .map((e) => ({
          ...serializeTimelineEntry(e),
          sent_to: null,
          answered_at: null,
          replies: [] as ReturnType<typeof serializeTimelineEntry>[],
        })),
    ].sort((a, b) => b.created_at.localeCompare(a.created_at))

    return NextResponse.json({ items })
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
