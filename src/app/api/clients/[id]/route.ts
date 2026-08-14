import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { clientInput } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { requireInternal, toResponse } from '@/lib/auth/internal'
import { serializeClient } from '@/lib/serialize'

// Maps the form's snake_case field names to columns. Only keys actually present
// in the request body are applied, so a PATCH of one field doesn't blank the
// rest — the same semantics the Supabase version had.
const FIELD_MAP = {
  name: 'name',
  email: 'billingEmail',
  phone: 'phone',
  tax_id: 'taxId',
  address_line1: 'addressLine1',
  address_line2: 'addressLine2',
  city: 'city',
  state: 'state',
  postal_code: 'postalCode',
  country: 'country',
} as const

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireInternal()
    const { id } = await params

    const body = await req.json()
    const archived = typeof body.archived === 'boolean' ? body.archived : undefined

    const parsed = clientInput.partial().safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const data: Record<string, unknown> = {}
    for (const [formKey, column] of Object.entries(FIELD_MAP)) {
      if (!(formKey in body)) continue
      const value = parsed.data[formKey as keyof typeof parsed.data]
      // `name` is required and must never be blanked; the rest normalise '' to
      // null so an empty form field clears the column rather than storing ''.
      data[column] = column === 'name' ? value : (value as string) || null
    }
    if (archived !== undefined) data.archived = archived

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const existing = await db.client.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    const client = await db.client.update({ where: { id }, data })

    await logAudit({
      action:
        archived !== undefined
          ? archived
            ? 'client.archive'
            : 'client.unarchive'
          : 'client.update',
      entityType: 'client',
      entityId: id,
      metadata: { name: client.name },
    })

    return NextResponse.json({ client: serializeClient(client) })
  } catch (error) {
    return toResponse(error)
  }
}
