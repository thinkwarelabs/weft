import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: invoice } = await db.from('invoices').select('*').eq('id', id).single()
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (invoice.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft invoices can be finalized' }, { status: 409 })
  }

  const { count } = await db.from('invoice_items').select('*', { count: 'exact', head: true }).eq('invoice_id', id)
  if (!count) return NextResponse.json({ error: 'Invoice has no items' }, { status: 400 })

  const { data: profile, error: pErr } = await db.from('business_profile').select('*').eq('id', 1).single()
  if (pErr || !profile) return NextResponse.json({ error: 'Business profile missing' }, { status: 500 })
  const { data: client, error: cErr } = await db.from('clients').select('*').eq('id', invoice.client_id).single()
  if (cErr || !client) return NextResponse.json({ error: 'Client missing' }, { status: 500 })

  const { data: number, error: nErr } = await db.rpc('allocate_invoice_number')
  if (nErr) return NextResponse.json({ error: nErr.message }, { status: 500 })

  const { data: updated, error } = await db
    .from('invoices')
    .update({
      invoice_number: number,
      status: 'finalized',
      business_snapshot: profile,
      client_snapshot: client,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invoice: updated })
}
