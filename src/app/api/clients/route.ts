import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { clientInput } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { pageCount, parsePagination } from '@/lib/pagination'
import { requireInternal, toResponse } from '@/lib/auth/internal'
import { serializeClient } from '@/lib/serialize'

export async function GET(req: Request) {
  try {
    await requireInternal()

    const params = new URL(req.url).searchParams
    const { page, pageSize, from } = parsePagination(params)
    const q = params.get('q')?.trim()

    // Prisma parameterises this, so the sanitizeIlike() dance the Supabase
    // version needed (escaping `,()*%` before interpolating into a PostgREST
    // filter string) is gone. Nothing is being interpolated any more.
    const where = {
      archived: false,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { billingEmail: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [clients, total] = await Promise.all([
      db.client.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: from,
        take: pageSize,
      }),
      db.client.count({ where }),
    ])

    return NextResponse.json({
      clients: clients.map(serializeClient),
      total,
      page,
      pageSize,
      pageCount: pageCount(total, pageSize),
    })
  } catch (error) {
    return toResponse(error)
  }
}

export async function POST(req: Request) {
  try {
    await requireInternal()

    const parsed = clientInput.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }
    const d = parsed.data

    const client = await db.client.create({
      data: {
        name: d.name,
        // The form field is still called "email"; it is the BILLING address.
        billingEmail: d.email || null,
        phone: d.phone || null,
        taxId: d.tax_id || null,
        addressLine1: d.address_line1 || null,
        addressLine2: d.address_line2 || null,
        city: d.city || null,
        state: d.state || null,
        postalCode: d.postal_code || null,
        country: d.country || null,
      },
    })

    await logAudit({
      action: 'client.create',
      entityType: 'client',
      entityId: client.id,
      metadata: { name: client.name },
    })

    return NextResponse.json({ client: serializeClient(client) }, { status: 201 })
  } catch (error) {
    return toResponse(error)
  }
}
