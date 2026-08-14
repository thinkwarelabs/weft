import { NextResponse } from 'next/server'
import { db, num } from '@/lib/db'
import { paymentInput } from '@/lib/validation'
import { round2 } from '@/lib/money'
import { logAudit } from '@/lib/audit'
import { requireInternal, toResponse } from '@/lib/auth/internal'
import { serializeInvoice } from '@/lib/serialize'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Ctx) {
  try {
    await requireInternal()
    const { id } = await params

    const existing = await db.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, total: true },
    })
    if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    if (existing.status !== 'finalized') {
      return NextResponse.json(
        { error: 'Only finalized invoices can be marked paid' },
        { status: 409 },
      )
    }

    const parsed = paymentInput.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }
    const { payment_date, amount_received, tds_amount, payment_reference } = parsed.data

    // Received + TDS must reconcile to the invoice total. num() first — mixing
    // a Decimal and a number in arithmetic is the one thing money.ts must never
    // be handed.
    if (round2(amount_received + tds_amount) !== round2(num(existing.total))) {
      return NextResponse.json(
        { error: 'Received + TDS must equal the invoice total' },
        { status: 400 },
      )
    }

    const invoice = await db.invoice.update({
      where: { id },
      data: {
        status: 'paid',
        paidAt: new Date(`${payment_date}T00:00:00.000Z`),
        amountReceived: amount_received,
        tdsAmount: tds_amount,
        paymentReference: payment_reference || null,
      },
    })

    await logAudit({
      action: 'invoice.mark_paid',
      entityType: 'invoice',
      entityId: id,
      metadata: { invoice_number: invoice.invoiceNumber, amount_received, tds_amount },
    })

    return NextResponse.json({ invoice: serializeInvoice(invoice) })
  } catch (error) {
    return toResponse(error)
  }
}
