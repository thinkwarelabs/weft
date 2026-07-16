import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { db } from '@/lib/supabase'
import { InvoicePdf, InvoicePdfData, PdfParty } from '@/lib/pdf/InvoicePdf'
import { BusinessProfile, Client, Invoice, InvoiceItem } from '@/lib/types'

export const runtime = 'nodejs'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = new URL(req.url)
  const download = url.searchParams.get('download') === '1'

  const { data: invoice } = await db.from('invoices').select('*').eq('id', id).single<Invoice>()
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const { data: items } = await db
    .from('invoice_items').select('*').eq('invoice_id', id).order('sort_order').returns<InvoiceItem[]>()

  let business: BusinessProfile | null = invoice.business_snapshot
  let client: Client | null = invoice.client_snapshot
  if (!business) {
    const { data } = await db.from('business_profile').select('*').eq('id', 1).single<BusinessProfile>()
    business = data
  }
  if (!client) {
    const { data } = await db.from('clients').select('*').eq('id', invoice.client_id).single<Client>()
    client = data
  }
  if (!business || !client) return NextResponse.json({ error: 'Invoice data incomplete' }, { status: 500 })

  const data: InvoicePdfData = {
    number: invoice.invoice_number ?? 'DRAFT',
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    business: business as PdfParty,
    client: { ...client, name: client.name } as PdfParty,
    currency: invoice.currency,
    taxLabel: invoice.tax_label,
    taxRate: Number(invoice.tax_rate),
    paymentLink: invoice.payment_link,
    notes: invoice.notes,
    items: (items ?? []).map((it) => ({
      description: it.description,
      period: it.period,
      qty: Number(it.qty),
      unitPrice: Number(it.unit_price),
      amount: Number(it.amount),
    })),
    subtotal: Number(invoice.subtotal),
    taxAmount: Number(invoice.tax_amount),
    total: Number(invoice.total),
  }

  const buffer = await renderToBuffer(InvoicePdf({ data }))
  const filename = `Invoice-${invoice.invoice_number ?? 'DRAFT'}.pdf`
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
