import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase'
import { invoiceInput } from '@/lib/validation'
import { computeTotals, lineBreakdown, preTaxUnitPrice } from '@/lib/money'

export async function GET() {
  const { data, error } = await db
    .from('invoices')
    .select('id, invoice_number, issue_date, due_date, status, currency, total, created_at, updated_at, clients(name)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invoices: data })
}

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = invoiceInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const { items: enteredItems, ...inv } = parsed.data
  // Totals are computed from the ENTERED prices: computeTotals splits tax per
  // line, so a GST-inclusive line sums back to exactly what was typed.
  const totals = computeTotals(enteredItems, inv.tax_rate)

  const { data: invoice, error } = await db
    .from('invoices')
    .insert({
      ...inv,
      payment_link: inv.payment_link || null,
      notes: inv.notes || null,
      tax_label: inv.tax_label || null,
      subtotal: totals.subtotal,
      tax_amount: totals.taxAmount,
      total: totals.total,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = enteredItems.map((it, i) => ({
    invoice_id: invoice.id,
    description: it.description,
    period: it.period || null,
    qty: it.qty,
    unit_price: preTaxUnitPrice(it.unit_price, it.gst_included, inv.tax_rate),
    gst_included: it.gst_included,
    entered_unit_price: it.unit_price,
    // Same per-line net used by computeTotals, so line amounts sum to subtotal.
    amount: lineBreakdown(it, inv.tax_rate).net,
    sort_order: i,
  }))
  const { error: itemsError } = await db.from('invoice_items').insert(rows)
  if (itemsError) {
    await db.from('invoices').delete().eq('id', invoice.id) // rollback
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }
  return NextResponse.json({ invoice }, { status: 201 })
}
