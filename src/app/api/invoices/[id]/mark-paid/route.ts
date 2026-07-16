import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: existing } = await db.from('invoices').select('id, status').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (existing.status !== 'finalized') {
    return NextResponse.json({ error: 'Only finalized invoices can be marked paid' }, { status: 409 })
  }
  const { data: invoice, error } = await db
    .from('invoices')
    .update({ status: 'paid', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invoice })
}
