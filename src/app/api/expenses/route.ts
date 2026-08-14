import { NextResponse } from 'next/server'
import { db, num } from '@/lib/db'
import { expenseInput } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { requireInternal, toResponse } from '@/lib/auth/internal'
import { serializeExpense } from '@/lib/serialize'

export async function GET() {
  try {
    await requireInternal()

    const expenses = await db.expense.findMany({ orderBy: { expenseDate: 'desc' } })
    return NextResponse.json({ expenses: expenses.map(serializeExpense) })
  } catch (error) {
    return toResponse(error)
  }
}

export async function POST(req: Request) {
  try {
    await requireInternal()

    const parsed = expenseInput.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }
    const d = parsed.data

    const expense = await db.expense.create({
      data: {
        name: d.name,
        expenseType: d.expense_type || null,
        amount: d.amount,
        currency: d.currency,
        payerType: d.payer_type,
        payerName: d.payer_name || null,
        expenseDate: new Date(`${d.expense_date}T00:00:00.000Z`),
        note: d.note || null,
      },
    })

    await logAudit({
      action: 'expense.create',
      entityType: 'expense',
      entityId: expense.id,
      metadata: { amount: num(expense.amount), expense_type: expense.expenseType },
    })

    return NextResponse.json({ expense: serializeExpense(expense) }, { status: 201 })
  } catch (error) {
    return toResponse(error)
  }
}
