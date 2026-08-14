import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { requireInternal, toResponse } from '@/lib/auth/internal'
import { serializeInvoice } from '@/lib/serialize'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Ctx) {
  try {
    await requireInternal()
    const { id } = await params

    const existing = await db.invoice.findUnique({
      where: { id },
      select: { id: true, status: true },
    })
    if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    if (existing.status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Only cancelled invoices can be restored' },
        { status: 409 },
      )
    }

    // Back to `finalized`, never to `draft` — the number is already allocated
    // and the snapshots are already frozen, so it is an issued document.
    const invoice = await db.invoice.update({
      where: { id },
      data: { status: 'finalized' },
    })

    await logAudit({
      action: 'invoice.unvoid',
      entityType: 'invoice',
      entityId: id,
      metadata: { invoice_number: invoice.invoiceNumber },
    })

    return NextResponse.json({ invoice: serializeInvoice(invoice) })
  } catch (error) {
    return toResponse(error)
  }
}
