import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { requireInternal, toResponse } from '@/lib/auth/internal'
import { mintClientToken, revokeClientToken } from '@/lib/auth/client-token'
import { sendFeedbackRequestEmail } from '@/lib/client-email'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

const input = z.object({
  contact_id: z.string().min(1, 'Pick a contact'),
  prompt: z.string().trim().min(1, 'Say what you want feedback on').max(1_000),
})

export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireInternal()
    const { id } = await params

    const requests = await db.feedbackRequest.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        contact: { select: { id: true, name: true, email: true, active: true } },
        requestedBy: { select: { name: true, email: true } },
      },
    })

    return NextResponse.json({
      requests: requests.map((r) => ({
        id: r.id,
        prompt: r.prompt,
        created_at: r.createdAt.toISOString(),
        responded_at: r.respondedAt?.toISOString() ?? null,
        contact: r.contact,
        requested_by: r.requestedBy.name ?? r.requestedBy.email,
      })),
    })
  } catch (error) {
    return toResponse(error)
  }
}

// Mint a scoped link and email it. This is the ONLY place a client credential
// is created, and the raw token exists here for the duration of one function
// call before going into the email body.
export async function POST(req: Request, { params }: Ctx) {
  try {
    const actor = await requireInternal()
    const { id } = await params

    const parsed = input.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }
    const { contact_id, prompt } = parsed.data

    const project = await db.project.findUnique({
      where: { id },
      select: { id: true, name: true, clientId: true, archivedAt: true },
    })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const contact = await db.clientContact.findUnique({
      where: { id: contact_id },
      select: { id: true, name: true, email: true, active: true, clientId: true },
    })
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

    // Belt and braces on top of the same check inside mintClientToken: a
    // contact from a different client must never receive a link to this
    // project, and it should fail here with a clear message rather than
    // surfacing as a generic mint error.
    if (contact.clientId !== project.clientId) {
      return NextResponse.json(
        { error: 'That contact belongs to a different client.' },
        { status: 400 },
      )
    }
    if (!contact.active) {
      return NextResponse.json({ error: 'That contact is deactivated.' }, { status: 400 })
    }

    const { url, tokenId, expiresAt } = await mintClientToken({
      contactId: contact.id,
      projectId: project.id,
      createdByEmail: actor.email,
    })

    try {
      await sendFeedbackRequestEmail({
        to: contact.email,
        contactName: contact.name,
        projectName: project.name,
        prompt,
        url,
        expiresAt,
      })
    } catch (e) {
      // The credential exists but nobody received it. Revoke it rather than
      // leaving a live token nobody asked for, and report the failure — unlike
      // the invoice notification, the email IS the deliverable here.
      await revokeClientToken(tokenId)
      await logAudit({
        action: 'client_token.send_failed',
        entityType: 'client_token',
        entityId: tokenId,
        metadata: { projectId: id, contactId: contact.id },
      })
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Could not send the email.' },
        { status: 502 },
      )
    }

    const request = await db.feedbackRequest.create({
      data: {
        projectId: project.id,
        contactId: contact.id,
        prompt,
        requestedById: actor.id,
      },
    })

    await logAudit({
      action: 'client_token.mint',
      entityType: 'client_token',
      entityId: tokenId,
      metadata: { projectId: id, contactId: contact.id, expiresAt: expiresAt.toISOString() },
    })

    return NextResponse.json(
      {
        request: {
          id: request.id,
          prompt: request.prompt,
          created_at: request.createdAt.toISOString(),
          responded_at: null,
          contact: { id: contact.id, name: contact.name, email: contact.email, active: true },
          requested_by: actor.name ?? actor.email,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    return toResponse(error)
  }
}
