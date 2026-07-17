import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params
  const { data: existing } = await db.from('invoices').select('id, status').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (existing.status !== 'paid') {
    return NextResponse.json({ error: 'Only paid invoices can be unmarked paid' }, { status: 409 })
  }
  const { data: invoice, error } = await db
    .from('invoices')
    .update({
      status: 'finalized',
      paid_at: null,
      amount_received: null,
      tds_amount: 0,
      payment_reference: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ action: 'invoice.unmark_paid', entityType: 'invoice', entityId: id, metadata: { invoice_number: invoice.invoice_number } })
  return NextResponse.json({ invoice })
}
