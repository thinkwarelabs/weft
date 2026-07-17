import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase'
import { paymentInput } from '@/lib/validation'
import { round2 } from '@/lib/money'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params
  const { data: existing } = await db.from('invoices').select('*').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (existing.status !== 'finalized') {
    return NextResponse.json({ error: 'Only finalized invoices can be marked paid' }, { status: 409 })
  }

  const body = await req.json()
  const parsed = paymentInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const { payment_date, amount_received, tds_amount, payment_reference } = parsed.data

  if (round2(amount_received + tds_amount) !== round2(Number(existing.total))) {
    return NextResponse.json({ error: 'Received + TDS must equal the invoice total' }, { status: 400 })
  }

  const { data: invoice, error } = await db
    .from('invoices')
    .update({
      status: 'paid',
      paid_at: `${payment_date}T00:00:00.000Z`,
      amount_received,
      tds_amount,
      payment_reference: payment_reference || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invoice })
}
