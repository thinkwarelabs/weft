import { describe, expect, it } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { InvoicePdf, InvoicePdfData } from './InvoicePdf'

const sample: InvoicePdfData = {
  number: 'TWL-0001',
  issueDate: '2026-07-10',
  dueDate: '2026-07-10',
  business: {
    company_name: 'Thinkware Labs',
    address_line1: '440 N Barranca Ave #4133',
    address_line2: null,
    city: 'Covina', state: 'California', postal_code: '91723', country: 'United States',
    email: 'contact@gomagentic.com', phone: null,
    tax_id: '9926USA29034OS9',
    legal_note: 'Registered person liable for GST/VAT under reverse charge.',
    bank_account_name: 'Thinkware Labs', bank_name: 'HDFC Bank',
    bank_account_number: '1234567890', bank_ifsc: 'HDFC0000001',
  },
  client: {
    name: 'Magentic',
    address_line1: 'Octus Quantum samaspur sector 51', address_line2: null,
    city: 'Gurugram', state: 'MAHARASHTRA', postal_code: '122001', country: 'India',
    email: 'dev@magentic.in', tax_id: null,
  },
  currency: 'USD',
  taxLabel: 'IGST - INDIA',
  taxRate: 18,
  paymentLink: null,
  notes: null,
  items: [{ description: 'Pro', period: 'Jul 10–Aug 9, 2026', qty: 1, unitPrice: 20, amount: 20 }],
  subtotal: 20,
  taxAmount: 3.6,
  total: 23.6,
}

describe('InvoicePdf', () => {
  it('renders a valid one-page PDF', async () => {
    const buf = await renderToBuffer(InvoicePdf({ data: sample }))
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(buf.length).toBeGreaterThan(10_000)
  })
  it('renders without optional fields (draft, no tax, no bank)', async () => {
    const minimal: InvoicePdfData = {
      ...sample,
      number: 'DRAFT',
      taxLabel: null, taxRate: 0, taxAmount: 0, total: 20,
      business: { ...sample.business, tax_id: null, legal_note: null, bank_account_name: null, bank_name: null, bank_account_number: null, bank_ifsc: null },
    }
    const buf = await renderToBuffer(InvoicePdf({ data: minimal }))
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
  })
})
