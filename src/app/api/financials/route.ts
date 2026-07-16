import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase'

const isoDate = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  if (!isoDate.test(from) || !isoDate.test(to) || from > to) {
    return NextResponse.json({ error: 'Provide from and to as YYYY-MM-DD, with from <= to' }, { status: 400 })
  }

  const { data: invoiceRows, error: invoiceError } = await db
    .from('invoices')
    .select('id, invoice_number, currency, subtotal, tax_amount, total, paid_at, updated_at, clients(name)')
    .eq('status', 'paid')
  if (invoiceError) return NextResponse.json({ error: invoiceError.message }, { status: 500 })

  const invoices = (invoiceRows ?? [])
    .map((row) => ({ ...row, paidDate: ((row.paid_at ?? row.updated_at) as string).slice(0, 10) }))
    .filter((row) => row.paidDate >= from && row.paidDate <= to)

  const { data: expenses, error: expensesError } = await db
    .from('expenses')
    .select('*')
    .gte('expense_date', from)
    .lte('expense_date', to)
    .order('expense_date', { ascending: false })
  if (expensesError) return NextResponse.json({ error: expensesError.message }, { status: 500 })

  return NextResponse.json({ invoices, expenses })
}
