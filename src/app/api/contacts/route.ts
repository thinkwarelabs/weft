import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { clientContactInput } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { requireInternal, toResponse } from '@/lib/auth/internal'
import { serializeClientContact } from '@/lib/serialize'

// ClientContact is a named human who can be sent a feedback link. It is NOT
// Client.billingEmail (where invoices go) — see CLAUDE.md. Conflating them is
// how a client's accounts department ends up holding a feedback link.
export async function GET(req: Request) {
  try {
    await requireInternal()

    const params = new URL(req.url).searchParams
    const clientId = params.get('clientId')?.trim()
    const includeInactive = params.get('includeInactive') === '1'

    const contacts = await db.clientContact.findMany({
      where: {
        ...(clientId ? { clientId } : {}),
        ...(includeInactive ? {} : { active: true }),
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    })

    return NextResponse.json({ contacts: contacts.map(serializeClientContact) })
  } catch (error) {
    return toResponse(error)
  }
}

export async function POST(req: Request) {
  try {
    await requireInternal()

    const parsed = clientContactInput.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }
    const d = parsed.data

    const client = await db.client.findUnique({
      where: { id: d.client_id },
      select: { id: true, name: true },
    })
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    // @@unique([clientId, email]) — one row per person per client. Report the
    // collision as a field error rather than letting P2002 surface as a 500.
    const clash = await db.clientContact.findUnique({
      where: { clientId_email: { clientId: d.client_id, email: d.email } },
      select: { id: true },
    })
    if (clash) {
      return NextResponse.json(
        { error: 'Invalid input', issues: { email: ['This client already has that contact'] } },
        { status: 400 },
      )
    }

    const contact = await db.clientContact.create({
      data: {
        clientId: d.client_id,
        name: d.name,
        email: d.email,
        title: d.title || null,
      },
    })

    await logAudit({
      action: 'contact.create',
      entityType: 'contact',
      entityId: contact.id,
      metadata: { name: contact.name, client: client.name },
    })

    return NextResponse.json({ contact: serializeClientContact(contact) }, { status: 201 })
  } catch (error) {
    return toResponse(error)
  }
}
