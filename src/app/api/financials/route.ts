import { NextResponse } from 'next/server'
import { db, num } from '@/lib/db'
import { requireInternal, toResponse } from '@/lib/auth/internal'
import { serializeExpense } from '@/lib/serialize'

const isoDate = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: Request) {
  try {
    await requireInternal()

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from') ?? ''
    const to = searchParams.get('to') ?? ''
    if (!isoDate.test(from) || !isoDate.test(to) || from > to) {
      return NextResponse.json(
        { error: 'Provide from and to as YYYY-MM-DD, with from <= to' },
        { status: 400 },
      )
    }

    const [paid, expenses] = await Promise.all([
      db.invoice.findMany({
        where: { status: 'paid' },
        select: {
          id: true,
          invoiceNumber: true,
          currency: true,
          subtotal: true,
          taxAmount: true,
          total: true,
          amountReceived: true,
          tdsAmount: true,
          paidAt: true,
          updatedAt: true,
          client: { select: { name: true } },
        },
      }),
      db.expense.findMany({
        where: {
          expenseDate: {
            gte: new Date(`${from}T00:00:00.000Z`),
            lte: new Date(`${to}T00:00:00.000Z`),
          },
        },
        orderBy: { expenseDate: 'desc' },
      }),
    ])

    // Revenue is bucketed by the day the money landed. paid_at is null for
    // invoices marked paid before payment recording existed, so fall back to
    // updated_at — the same rule the Supabase version used. Filtering happens
    // in JS because the effective date is a COALESCE the query can't index
    // anyway, and the paid set is small.
    const invoices = paid
      .map((row) => ({
        id: row.id,
        invoice_number: row.invoiceNumber,
        currency: row.currency,
        subtotal: num(row.subtotal),
        tax_amount: num(row.taxAmount),
        total: num(row.total),
        amount_received: row.amountReceived == null ? null : num(row.amountReceived),
        tds_amount: num(row.tdsAmount),
        paid_at: row.paidAt?.toISOString() ?? null,
        updated_at: row.updatedAt.toISOString(),
        clients: row.client ? { name: row.client.name } : null,
        paidDate: (row.paidAt ?? row.updatedAt).toISOString().slice(0, 10),
      }))
      .filter((row) => row.paidDate >= from && row.paidDate <= to)

    return NextResponse.json({ invoices, expenses: expenses.map(serializeExpense) })
  } catch (error) {
    return toResponse(error)
  }
}
