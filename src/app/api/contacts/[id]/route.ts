import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { clientContactPatchInput } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { requireInternal, toResponse } from '@/lib/auth/internal'
import { serializeClientContact } from '@/lib/serialize'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    await requireInternal()
    const { id } = await params

    const body = await req.json()
    const parsed = clientContactPatchInput.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }
    const d = parsed.data

    const existing = await db.clientContact.findUnique({
      where: { id },
      select: { id: true, clientId: true, name: true },
    })
    if (!existing) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if ('name' in body && d.name !== undefined) data.name = d.name
    if ('email' in body && d.email !== undefined) data.email = d.email
    if ('title' in body) data.title = d.title || null
    if ('active' in body && d.active !== undefined) data.active = d.active

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    if (typeof data.email === 'string') {
      const clash = await db.clientContact.findUnique({
        where: { clientId_email: { clientId: existing.clientId, email: data.email } },
        select: { id: true },
      })
      if (clash && clash.id !== id) {
        return NextResponse.json(
          { error: 'Invalid input', issues: { email: ['This client already has that contact'] } },
          { status: 400 },
        )
      }
    }

    const contact = await db.clientContact.update({ where: { id }, data })

    // Deactivating is the revocation path: lib/auth/client-token.ts re-reads
    // contact.active on EVERY request, so setting active=false cuts off any
    // live feedback session immediately rather than at cookie expiry.
    await logAudit({
      action:
        d.active === false
          ? 'contact.deactivate'
          : d.active === true
            ? 'contact.reactivate'
            : 'contact.update',
      entityType: 'contact',
      entityId: id,
      metadata: { name: contact.name },
    })

    return NextResponse.json({ contact: serializeClientContact(contact) })
  } catch (error) {
    return toResponse(error)
  }
}
