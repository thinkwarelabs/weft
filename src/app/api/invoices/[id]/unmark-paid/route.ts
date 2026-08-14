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
    if (existing.status !== 'paid') {
      return NextResponse.json(
        { error: 'Only paid invoices can be unmarked paid' },
        { status: 409 },
      )
    }

    // Clear the payment record entirely — a half-reverted payment is worse than
    // either state.
    const invoice = await db.invoice.update({
      where: { id },
      data: {
        status: 'finalized',
        paidAt: null,
        amountReceived: null,
        tdsAmount: 0,
        paymentReference: null,
      },
    })

    await logAudit({
      action: 'invoice.unmark_paid',
      entityType: 'invoice',
      entityId: id,
      metadata: { invoice_number: invoice.invoiceNumber },
    })

    return NextResponse.json({ invoice: serializeInvoice(invoice) })
  } catch (error) {
    return toResponse(error)
  }
}
