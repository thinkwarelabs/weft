import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase'
import { invoiceInput } from '@/lib/validation'
import { computeTotals, lineBreakdown, preTaxUnitPrice, round2 } from '@/lib/money'
import { logAudit } from '@/lib/audit'
import { pageCount, parsePagination } from '@/lib/pagination'
import { sanitizeIlike } from '@/lib/search'
import { todayISO } from '@/lib/dates'

const LIST_COLUMNS =
  'id, invoice_number, issue_date, due_date, status, currency, total, created_at, updated_at, clients(name)'

type MoneyRow = { currency: string; total: number | string }

// Sum a set of rows into a { currency: amount } map, rounded to 2dp.
function sumByCurrency(rows: MoneyRow[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) out[r.currency] = round2((out[r.currency] ?? 0) + Number(r.total))
  return out
}

// The summary cards must reflect the WHOLE dataset, independent of the page or
// the active filter, so they come from their own targeted queries.
async function loadStats(today: string) {
  const [y, m] = today.split('-').map(Number)
  const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
  const nextMonthStart = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`

  const [{ data: finalized }, { data: paid }, { count: totalCount }] = await Promise.all([
    db.from('invoices').select('currency, total, due_date').eq('status', 'finalized'),
    db.from('invoices').select('currency, total').eq('status', 'paid').gte('updated_at', monthStart).lt('updated_at', nextMonthStart),
    db.from('invoices').select('*', { count: 'exact', head: true }),
  ])

  const finalizedRows = finalized ?? []
  const overdueRows = finalizedRows.filter((r) => (r.due_date as string) < today)
  return {
    outstanding: sumByCurrency(finalizedRows),
    overdue: sumByCurrency(overdueRows),
    overdueCount: overdueRows.length,
    paidThisMonth: sumByCurrency(paid ?? []),
    totalCount: totalCount ?? 0,
  }
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const { page, pageSize, from, to } = parsePagination(params)
  const status = params.get('status') ?? 'all'
  // "Overdue" and the month boundary depend on the current day. The client sends
  // the day it is actually showing (its own timezone) so the server-side filter
  // agrees with the "Overdue" badges the browser renders; fall back to the
  // server's day for direct/unparameterised calls.
  const clientToday = params.get('today')
  const today = clientToday && /^\d{4}-\d{2}-\d{2}$/.test(clientToday) ? clientToday : todayISO()

  let query = db.from('invoices').select(LIST_COLUMNS, { count: 'exact' })

  // Status tab → server-side filter. "overdue" is derived (finalized + past due).
  if (status === 'overdue') {
    query = query.eq('status', 'finalized').lt('due_date', today)
  } else if (status !== 'all') {
    query = query.eq('status', status)
  }

  // Search matches the invoice number OR the client name. Client name lives on a
  // joined table, so resolve matching client ids first, then OR them in.
  const q = sanitizeIlike(params.get('q'))
  if (q) {
    const { data: clientMatches } = await db.from('clients').select('id').ilike('name', `%${q}%`)
    const ids = (clientMatches ?? []).map((c) => c.id)
    const orParts = [`invoice_number.ilike.*${q}*`]
    if (ids.length) orParts.push(`client_id.in.(${ids.join(',')})`)
    query = query.or(orParts.join(','))
  }

  // The "All" tab is ordered by invoice number descending, with unnumbered
  // drafts on top; every other tab keeps newest-created first.
  if (status === 'all') {
    query = query
      .order('invoice_number', { ascending: false, nullsFirst: true })
      .order('created_at', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  const [{ data, error, count }, stats] = await Promise.all([query.range(from, to), loadStats(today)])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const total = count ?? 0
  return NextResponse.json({
    invoices: data,
    total,
    page,
    pageSize,
    pageCount: pageCount(total, pageSize),
    stats,
  })
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
  await logAudit({ action: 'invoice.create', entityType: 'invoice', entityId: invoice.id, metadata: { total: invoice.total, currency: invoice.currency } })
  return NextResponse.json({ invoice }, { status: 201 })
}
