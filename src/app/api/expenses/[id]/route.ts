import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase'
import { expensePatchInput } from '@/lib/validation'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  const { data: existing } = await db.from('expenses').select('*').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })

  const body = await req.json()
  const parsed = expensePatchInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const update: Record<string, unknown> = Object.fromEntries(
    Object.entries(parsed.data).filter(([k]) => k in body)
  )
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  // Cross-field rule from expenseInput's superRefine (person requires payer_name), re-checked
  // here against the merged existing+patch state since expensePatchInput has no refine of its own.
  const effectivePayerType = (update.payer_type as string | undefined) ?? existing.payer_type
  const effectivePayerName = ((update.payer_name as string | undefined) ?? existing.payer_name ?? '') as string
  if (effectivePayerType === 'person' && effectivePayerName.trim() === '') {
    return NextResponse.json(
      { error: 'Invalid input', issues: { payer_name: ['Payer name is required when payer type is person'] } },
      { status: 400 }
    )
  }

  const { data, error } = await db.from('expenses').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expense: data })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  const { data: existing } = await db.from('expenses').select('id').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
  const { error } = await db.from('expenses').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
