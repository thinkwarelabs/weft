import { NextResponse } from 'next/server'
import { db, num } from '@/lib/db'
import { invoiceInput } from '@/lib/validation'
import { computeTotals, lineBreakdown, preTaxUnitPrice, round2 } from '@/lib/money'
import { logAudit } from '@/lib/audit'
import { pageCount, parsePagination } from '@/lib/pagination'
import { todayISO } from '@/lib/dates'
import { requireInternal, toResponse } from '@/lib/auth/internal'
import { serializeInvoice, serializeInvoiceListRow } from '@/lib/serialize'
import { ensureDefaultProject } from '@/lib/projects'
import type { InvoiceStatus, Prisma } from '@/generated/prisma/client'

type MoneyRow = { currency: string; total: { toNumber(): number } }

// Sum rows into a { currency: amount } map, rounded to 2dp.
function sumByCurrency(rows: MoneyRow[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) out[r.currency] = round2((out[r.currency] ?? 0) + num(r.total))
  return out
}

// The summary cards reflect the WHOLE dataset, independent of the page or the
// active filter, so they come from their own queries rather than the page slice.
async function loadStats(today: string) {
  const [y, m] = today.split('-').map(Number)
  const monthStart = new Date(Date.UTC(y!, m! - 1, 1))
  const nextMonthStart = new Date(Date.UTC(m === 12 ? y! + 1 : y!, m === 12 ? 0 : m!, 1))
  const todayDate = new Date(`${today}T00:00:00.000Z`)

  const [finalized, paidMonth, paidAll, totalCount, draftCount, cancelledCount] =
    await Promise.all([
      db.invoice.findMany({
        where: { status: 'finalized' },
        select: { currency: true, total: true, dueDate: true },
      }),
      db.invoice.findMany({
        where: { status: 'paid', updatedAt: { gte: monthStart, lt: nextMonthStart } },
        select: { currency: true, total: true },
      }),
      db.invoice.findMany({
        where: { status: 'paid' },
        select: { currency: true, total: true, amountReceived: true, tdsAmount: true },
      }),
      db.invoice.count(),
      db.invoice.count({ where: { status: 'draft' } }),
      db.invoice.count({ where: { status: 'cancelled' } }),
    ])

  const overdueRows = finalized.filter((r) => r.dueDate < todayDate)

  // Cash actually received and TDS withheld, per currency. Invoices marked paid
  // before payment recording existed have no amount_received — treat those as
  // received in full (total minus any recorded TDS).
  const received: Record<string, number> = {}
  const tds: Record<string, number> = {}
  for (const r of paidAll) {
    const tdsAmt = num(r.tdsAmount)
    const recv = r.amountReceived == null ? num(r.total) - tdsAmt : num(r.amountReceived)
    received[r.currency] = round2((received[r.currency] ?? 0) + recv)
    if (tdsAmt) tds[r.currency] = round2((tds[r.currency] ?? 0) + tdsAmt)
  }

  return {
    outstanding: sumByCurrency(finalized),
    overdue: sumByCurrency(overdueRows),
    overdueCount: overdueRows.length,
    paidThisMonth: sumByCurrency(paidMonth),
    totalCount,
    // Issued documents only: drafts and cancelled invoices are excluded.
    issuedCount: totalCount - draftCount - cancelledCount,
    draftCount,
    cancelledCount,
    invoiced: sumByCurrency([...finalized, ...paidAll]),
    received,
    tds,
  }
}

export async function GET(req: Request) {
  try {
    await requireInternal()

    const params = new URL(req.url).searchParams
    const { page, pageSize, from } = parsePagination(params)
    const status = params.get('status') ?? 'all'

    // "Overdue" and the month boundary depend on the current day. The client
    // sends the day it is actually showing (its own timezone) so the server
    // filter agrees with the "Overdue" badges the browser renders.
    const clientToday = params.get('today')
    const today =
      clientToday && /^\d{4}-\d{2}-\d{2}$/.test(clientToday) ? clientToday : todayISO()

    const where: Prisma.InvoiceWhereInput = {}
    if (status === 'overdue') {
      where.status = 'finalized'
      where.dueDate = { lt: new Date(`${today}T00:00:00.000Z`) }
    } else if (status !== 'all') {
      where.status = status as InvoiceStatus
    }

    // Search matches the invoice number OR the client name. The Supabase
    // version resolved client ids first and interpolated them into an `in()`
    // filter; a relation filter does it in one query with no id list.
    const q = params.get('q')?.trim()
    if (q) {
      where.OR = [
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
        { client: { name: { contains: q, mode: 'insensitive' } } },
      ]
    }

    // The "All" tab orders by invoice number descending with unnumbered drafts
    // on top; every other tab keeps newest-created first.
    const orderBy: Prisma.InvoiceOrderByWithRelationInput[] =
      status === 'all'
        ? [{ invoiceNumber: { sort: 'desc', nulls: 'first' } }, { createdAt: 'desc' }]
        : [{ createdAt: 'desc' }]

    const [rows, total, stats] = await Promise.all([
      db.invoice.findMany({
        where,
        orderBy,
        skip: from,
        take: pageSize,
        select: {
          id: true,
          invoiceNumber: true,
          issueDate: true,
          dueDate: true,
          status: true,
          currency: true,
          total: true,
          createdAt: true,
          updatedAt: true,
          client: { select: { name: true } },
        },
      }),
      db.invoice.count({ where }),
      loadStats(today),
    ])

    return NextResponse.json({
      invoices: rows.map(serializeInvoiceListRow),
      total,
      page,
      pageSize,
      pageCount: pageCount(total, pageSize),
      stats,
    })
  } catch (error) {
    return toResponse(error)
  }
}

export async function POST(req: Request) {
  try {
    await requireInternal()

    const parsed = invoiceInput.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }
    const { items: enteredItems, ...inv } = parsed.data

    // Totals are computed from the ENTERED prices: computeTotals splits tax per
    // line, so a GST-inclusive line sums back to exactly what was typed.
    const totals = computeTotals(enteredItems, inv.tax_rate)

    // One transaction. The Supabase version inserted the invoice, then the
    // items, and on item failure issued a manual delete as a "rollback" — a
    // crash between the two left a headless invoice. That is no longer possible.
    const invoice = await db.$transaction(async (tx) => {
      const projectId = await ensureDefaultProject(tx, inv.client_id)

      return tx.invoice.create({
        data: {
          clientId: inv.client_id,
          projectId,
          issueDate: new Date(`${inv.issue_date}T00:00:00.000Z`),
          dueDate: new Date(`${inv.due_date}T00:00:00.000Z`),
          currency: inv.currency,
          taxLabel: inv.tax_label || null,
          taxRate: inv.tax_rate,
          paymentLink: inv.payment_link || null,
          notes: inv.notes || null,
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          total: totals.total,
          items: {
            create: enteredItems.map((it, i) => ({
              description: it.description,
              period: it.period || null,
              qty: it.qty,
              unitPrice: preTaxUnitPrice(it.unit_price, it.gst_included, inv.tax_rate),
              gstIncluded: it.gst_included,
              enteredUnitPrice: it.unit_price,
              // Same per-line net computeTotals used, so line amounts sum to subtotal.
              amount: lineBreakdown(it, inv.tax_rate).net,
              sortOrder: i,
            })),
          },
        },
      })
    })

    await logAudit({
      action: 'invoice.create',
      entityType: 'invoice',
      entityId: invoice.id,
      metadata: { total: num(invoice.total), currency: invoice.currency },
    })

    return NextResponse.json({ invoice: serializeInvoice(invoice) }, { status: 201 })
  } catch (error) {
    return toResponse(error)
  }
}
