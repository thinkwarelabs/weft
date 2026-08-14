import 'server-only'
import { renderToBuffer } from '@react-pdf/renderer'
import { db } from '@/lib/db'
import { InvoicePdf, InvoicePdfData, PdfParty } from '@/lib/pdf/InvoicePdf'
import { lineBreakdown } from '@/lib/money'
import { BusinessProfile, Client, Invoice, InvoiceItem } from '@/lib/types'
import {
  serializeBusinessProfile,
  serializeClient,
  serializeInvoice,
  serializeInvoiceItem,
} from '@/lib/serialize'

export type BuiltInvoicePdf =
  | { ok: true; buffer: Buffer; filename: string; invoice: Invoice; client: Client; items: InvoiceItem[] }
  | { ok: false; error: string; status: number }

// Regenerated from stored data on every request — PDFs are never written to
// disk. That only stays safe because a finalized invoice carries frozen
// business/client snapshots, so editing the business profile later cannot
// change a document that has already gone to a client.
export async function buildInvoicePdf(id: string): Promise<BuiltInvoicePdf> {
  const row = await db.invoice.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!row) return { ok: false, error: 'Invoice not found', status: 404 }

  const invoice = serializeInvoice(row)
  const items = row.items.map(serializeInvoiceItem)

  // Snapshots are stored in the serialized (snake_case) shape, so they can be
  // handed straight to the renderer. A draft has none yet, so fall back to the
  // live records — a draft PDF is a preview and is allowed to move.
  let business = invoice.business_snapshot as BusinessProfile | null
  let client = invoice.client_snapshot as Client | null

  if (!business) {
    const profile = await db.businessProfile.findUnique({ where: { id: 1 } })
    business = profile ? (serializeBusinessProfile(profile) as BusinessProfile) : null
  }
  if (!client) {
    const c = await db.client.findUnique({ where: { id: row.clientId } })
    client = c ? (serializeClient(c) as Client) : null
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
    taxRate: invoice.tax_rate,
    paymentLink: invoice.payment_link,
    notes: invoice.notes,
    items: items.map((it) => ({
      description: it.description,
      period: it.period,
      qty: it.qty,
      unitPrice: it.unit_price,
      // Amount column shows the tax-inclusive line total (the column sums to
      // the invoice Total). Recomputed from the entered price so an inclusive
      // line lands exactly on what was typed.
      amount: lineBreakdown(
        {
          qty: it.qty,
          unit_price: it.entered_unit_price ?? it.unit_price,
          gst_included: it.gst_included,
        },
        invoice.tax_rate
      ).gross,
    })),
    subtotal: invoice.subtotal,
    taxAmount: invoice.tax_amount,
    total: invoice.total,
    cancelled: invoice.status === 'cancelled',
  }

  const buffer = await renderToBuffer(InvoicePdf({ data }))
  const filename = `Invoice-${invoice.invoice_number ?? 'DRAFT'}.pdf`
  return {
    ok: true,
    buffer,
    filename,
    invoice: invoice as unknown as Invoice,
    client,
    items: items as unknown as InvoiceItem[],
  }
}
