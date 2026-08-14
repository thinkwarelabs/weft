import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { expensePatchInput } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { requireInternal, toResponse } from '@/lib/auth/internal'
import { serializeExpense } from '@/lib/serialize'

type Ctx = { params: Promise<{ id: string }> }

const FIELD_MAP = {
  name: 'name',
  expense_type: 'expenseType',
  amount: 'amount',
  currency: 'currency',
  payer_type: 'payerType',
  payer_name: 'payerName',
  expense_date: 'expenseDate',
  note: 'note',
} as const

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    await requireInternal()
    const { id } = await params

    const existing = await db.expense.findUnique({
      where: { id },
      select: { id: true, payerType: true, payerName: true },
    })
    if (!existing) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })

    const body = await req.json()
    const parsed = expensePatchInput.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    // Only apply keys actually present in the raw body. `.partial()` still
    // defaults absent optional fields to '', so spreading parsed.data blindly
    // would blank every column the user didn't touch — see validation.test.ts,
    // which pins this hazard.
    const data: Record<string, unknown> = {}
    for (const [formKey, column] of Object.entries(FIELD_MAP)) {
      if (!(formKey in body)) continue
      const value = parsed.data[formKey as keyof typeof parsed.data]
      if (column === 'expenseDate') data[column] = new Date(`${value as string}T00:00:00.000Z`)
      else if (column === 'name' || column === 'amount' || column === 'currency' || column === 'payerType') data[column] = value
      else data[column] = (value as string) || null
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    // Cross-field rule from expenseInput's superRefine (person requires a payer
    // name), re-checked against the MERGED existing+patch state — expensePatchInput
    // has no refine of its own, because zod v4 refuses .partial() on a refined schema.
    const effectivePayerType = (data.payerType as string | undefined) ?? existing.payerType
    const effectivePayerName = ((data.payerName as string | null | undefined) ??
      existing.payerName ??
      '') as string
    if (effectivePayerType === 'person' && effectivePayerName.trim() === '') {
      return NextResponse.json(
        {
          error: 'Invalid input',
          issues: { payer_name: ['Payer name is required when payer type is person'] },
        },
        { status: 400 },
      )
    }

    const expense = await db.expense.update({ where: { id }, data })

    await logAudit({
      action: 'expense.update',
      entityType: 'expense',
      entityId: id,
      metadata: { fields: Object.keys(data) },
    })

    return NextResponse.json({ expense: serializeExpense(expense) })
  } catch (error) {
    return toResponse(error)
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    await requireInternal()
    const { id } = await params

    const existing = await db.expense.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })

    await db.expense.delete({ where: { id } })

    await logAudit({ action: 'expense.delete', entityType: 'expense', entityId: id })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return toResponse(error)
  }
}
