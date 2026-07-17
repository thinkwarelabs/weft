import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/supabase'
import { sendInvoiceGeneratedEmail } from '@/lib/email'
import { buildInvoicePdf } from '@/lib/pdf/buildInvoicePdf'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'

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

  await logAudit({ action: 'invoice.finalize', entityType: 'invoice', entityId: id, metadata: { invoice_number: number, total: updated.total } })

  // Notify the team by email. A failure here must never undo or fail the
  // finalization itself — the invoice number is already allocated.
  try {
    const session = await auth()
    const built = await buildInvoicePdf(id)
    if (built.ok) {
      await sendInvoiceGeneratedEmail({
        invoice: built.invoice,
        client: built.client,
        pdf: built.buffer,
        filename: built.filename,
        generatedBy: session?.user?.email ?? null,
      })
    } else {
      console.error(`Invoice ${number}: could not build PDF for notification email: ${built.error}`)
    }
  } catch (e) {
    console.error(`Invoice ${number}: notification email failed`, e)
  }

  return NextResponse.json({ invoice: updated })
}
