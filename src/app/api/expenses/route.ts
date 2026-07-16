import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase'
import { expenseInput } from '@/lib/validation'

export async function GET() {
  const { data, error } = await db.from('expenses').select('*').order('expense_date', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expenses: data })
}

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = expenseInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const { data, error } = await db
    .from('expenses')
    .insert({
      ...parsed.data,
      expense_type: parsed.data.expense_type || null,
      payer_name: parsed.data.payer_name || null,
      note: parsed.data.note || null,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expense: data }, { status: 201 })
}
