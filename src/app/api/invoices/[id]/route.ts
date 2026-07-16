import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase'
import { invoiceInput } from '@/lib/validation'
import { computeTotals, lineAmount } from '@/lib/money'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  const { data: invoice, error } = await db.from('invoices').select('*').eq('id', id).single()
  if (error || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  const { data: items } = await db.from('invoice_items').select('*').eq('invoice_id', id).order('sort_order')
  const { data: client } = await db.from('clients').select('*').eq('id', invoice.client_id).single()
  return NextResponse.json({ invoice, items: items ?? [], client })
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  const { data: existing } = await db.from('invoices').select('*').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (existing.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft invoices can be edited' }, { status: 409 })
  }
  const { data: oldItems } = await db.from('invoice_items').select('*').eq('invoice_id', id)

  const body = await req.json()
  const parsed = invoiceInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const { items, ...inv } = parsed.data
  const totals = computeTotals(items, inv.tax_rate)

  const { data: invoice, error } = await db
    .from('invoices')
    .update({
      ...inv,
      payment_link: inv.payment_link || null,
      notes: inv.notes || null,
      tax_label: inv.tax_label || null,
      subtotal: totals.subtotal,
      tax_amount: totals.taxAmount,
      total: totals.total,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from('invoice_items').delete().eq('invoice_id', id)
  const rows = items.map((it, i) => ({
    invoice_id: id,
    description: it.description,
    period: it.period || null,
    qty: it.qty,
    unit_price: it.unit_price,
    amount: lineAmount(it.qty, it.unit_price),
    sort_order: i,
  }))
  const { error: itemsError } = await db.from('invoice_items').insert(rows)
  if (itemsError) {
    // restore: re-insert old items and revert the invoice row to its previous values
    if (oldItems && oldItems.length > 0) {
      await db.from('invoice_items').insert(oldItems)
    }
    await db
      .from('invoices')
      .update({
        client_id: existing.client_id,
        issue_date: existing.issue_date,
        due_date: existing.due_date,
        currency: existing.currency,
        tax_label: existing.tax_label,
        tax_rate: existing.tax_rate,
        payment_link: existing.payment_link,
        notes: existing.notes,
        subtotal: existing.subtotal,
        tax_amount: existing.tax_amount,
        total: existing.total,
        updated_at: existing.updated_at,
      })
      .eq('id', id)
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }
  return NextResponse.json({ invoice })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  const { data: existing } = await db.from('invoices').select('id, status').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (existing.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft invoices can be deleted' }, { status: 409 })
  }
  const { error } = await db.from('invoices').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
