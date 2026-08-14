import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { requireInternal, toResponse } from '@/lib/auth/internal'
import { serializeInvoice } from '@/lib/serialize'

type Ctx = { params: Promise<{ id: string }> }

// Void, not delete. A finalized invoice has consumed an invoice number and may
// already be with the client, so it becomes `cancelled` and keeps its number.
// Numbers are never reused — a gap in the sequence is correct and auditable.
export async function POST(_req: Request, { params }: Ctx) {
  try {
    await requireInternal()
    const { id } = await params

    const existing = await db.invoice.findUnique({
      where: { id },
      select: { id: true, status: true },
    })
    if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    if (existing.status !== 'finalized') {
      return NextResponse.json(
        { error: 'Only finalized invoices can be voided' },
        { status: 409 },
      )
    }

    const invoice = await db.invoice.update({
      where: { id },
      data: { status: 'cancelled' },
    })

    await logAudit({
      action: 'invoice.void',
      entityType: 'invoice',
      entityId: id,
      metadata: { invoice_number: invoice.invoiceNumber },
    })

    return NextResponse.json({ invoice: serializeInvoice(invoice) })
  } catch (error) {
    return toResponse(error)
  }
}
