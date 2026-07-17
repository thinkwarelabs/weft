import { renderToBuffer } from '@react-pdf/renderer'
import { db } from '@/lib/supabase'
import { InvoicePdf, InvoicePdfData, PdfParty } from '@/lib/pdf/InvoicePdf'
import { lineBreakdown } from '@/lib/money'
import { BusinessProfile, Client, Invoice, InvoiceItem } from '@/lib/types'

export type BuiltInvoicePdf =
  | { ok: true; buffer: Buffer; filename: string; invoice: Invoice; client: Client; items: InvoiceItem[] }
  | { ok: false; error: string; status: number }

export async function buildInvoicePdf(id: string): Promise<BuiltInvoicePdf> {
  const { data: invoice } = await db.from('invoices').select('*').eq('id', id).single<Invoice>()
  if (!invoice) return { ok: false, error: 'Invoice not found', status: 404 }

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
  if (!business || !client) return { ok: false, error: 'Invoice data incomplete', status: 500 }

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
      // Amount column shows the tax-inclusive line total (the column sums to
      // the invoice Total). Recomputed from the entered price so an inclusive
      // line lands exactly on what was typed.
      amount: lineBreakdown(
        {
          qty: Number(it.qty),
          unit_price: Number(it.entered_unit_price ?? it.unit_price),
          gst_included: it.gst_included,
        },
        Number(invoice.tax_rate)
      ).gross,
    })),
    subtotal: Number(invoice.subtotal),
    taxAmount: Number(invoice.tax_amount),
    total: Number(invoice.total),
    cancelled: invoice.status === 'cancelled',
  }

  const buffer = await renderToBuffer(InvoicePdf({ data }))
  const filename = `Invoice-${invoice.invoice_number ?? 'DRAFT'}.pdf`
  return { ok: true, buffer, filename, invoice, client, items: items ?? [] }
}
