// SMTP smoke test: renders a sample invoice PDF and sends it through the
// real sendInvoiceGeneratedEmail path. Run from the project root:
//   bun run scripts/send-test-mail.ts
import { renderToBuffer } from '@react-pdf/renderer'
import { InvoicePdf, InvoicePdfData } from '../src/lib/pdf/InvoicePdf'
import { sendInvoiceGeneratedEmail, isEmailConfigured } from '../src/lib/email'
import { round2 } from '../src/lib/money'
import { Client, Invoice } from '../src/lib/types'

if (!isEmailConfigured()) {
  console.error('EMAIL_HOST / EMAIL_USER / EMAIL_TO not set — fill in .env.local first.')
  process.exit(1)
}

const today = new Date().toISOString().slice(0, 10)
const dueDate = new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10)

const client: Client = {
  id: 'sample',
  name: 'Urban Basket Retail Pvt. Ltd.',
  address_line1: '4th Floor, Orchid Business Park',
  address_line2: 'Sector 48, Sohna Road',
  city: 'Gurugram',
  state: 'Haryana',
  postal_code: '122018',
  country: 'India',
  email: 'accounts@urbanbasket.in',
  phone: '+91 98110 24500',
  tax_id: '06AABCU9603R1ZM',
  archived: false,
  created_at: new Date().toISOString(),
}

const items = [
  { description: 'E-commerce storefront development (Next.js + Supabase)', period: 'Jun 2026', qty: 1, unitPrice: 20000, amount: 20000 },
  { description: 'Payment gateway integration — Razorpay & Stripe', period: 'Jun 2026', qty: 1, unitPrice: 7400, amount: 7400 },
  { description: 'Product catalog & inventory management module', period: 'Jun 2026', qty: 1, unitPrice: 4500, amount: 4500 },
  { description: 'Hosting, maintenance & support', period: 'Jul 2026', qty: 1, unitPrice: 2000, amount: 2000 },
]
const subtotal = items.reduce((s, i) => s + i.amount, 0)
const taxRate = 18
const taxAmount = round2(subtotal * (taxRate / 100))
const total = round2(subtotal + taxAmount)

const invoice: Invoice = {
  id: 'sample',
  invoice_number: 'TWL-2026-014',
  client_id: 'sample',
  issue_date: today,
  due_date: dueDate,
  status: 'finalized',
  currency: 'INR',
  tax_label: 'GST',
  tax_rate: taxRate,
  payment_link: null,
  notes: 'Thank you for your business. Please make payment to the bank account listed above.',
  business_snapshot: null,
  client_snapshot: null,
  subtotal,
  tax_amount: taxAmount,
  total,
  paid_at: null,
  amount_received: null,
  tds_amount: 0,
  payment_reference: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const pdfData: InvoicePdfData = {
  number: invoice.invoice_number!,
  issueDate: invoice.issue_date,
  dueDate: invoice.due_date,
  business: {
    company_name: 'ThinkwareLabs IT Pvt. Ltd.',
    address_line1: 'Shri Ram Vichar Vatika',
    address_line2: null,
    city: 'Radaur',
    state: 'Haryana',
    postal_code: '135133',
    country: 'India',
    email: 'invoice@thinkwarelabs.com',
    phone: '+91 90342 20003',
    tax_id: '29AAKCT1234F1Z5',
    bank_account_name: 'ThinkwareLabs',
    bank_name: 'HDFC Bank',
    bank_account_number: '50200045678912',
    bank_ifsc: 'HDFC0000123',
  },
  client: { ...client },
  currency: invoice.currency,
  taxLabel: invoice.tax_label,
  taxRate: Number(invoice.tax_rate),
  paymentLink: invoice.payment_link,
  notes: invoice.notes,
  items,
  subtotal,
  taxAmount,
  total,
}

const pdf = await renderToBuffer(InvoicePdf({ data: pdfData }))
console.log(`PDF rendered (${pdf.length} bytes). Sending to ${process.env.EMAIL_TO} (cc: ${process.env.EMAIL_CC || 'none'})...`)
await sendInvoiceGeneratedEmail({
  invoice,
  client,
  pdf,
  filename: `Invoice-${invoice.invoice_number}.pdf`,
  generatedBy: 'thinkwarelabsit@gmail.com',
})
console.log('Sent OK — check the inbox.')
