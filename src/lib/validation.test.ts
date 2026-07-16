import { describe, expect, it } from 'vitest'
import { clientInput, invoiceInput, settingsInput } from './validation'

const validInvoice = {
  client_id: '2f9d2f7e-1111-4222-8333-444455556666',
  issue_date: '2026-07-10',
  due_date: '2026-07-10',
  currency: 'USD',
  tax_label: 'IGST - INDIA',
  tax_rate: 18,
  payment_link: '',
  notes: '',
  items: [{ description: 'Pro', period: 'Jul 10–Aug 9, 2026', qty: 1, unit_price: 20 }],
}

describe('invoiceInput', () => {
  it('accepts a valid invoice', () => {
    expect(invoiceInput.safeParse(validInvoice).success).toBe(true)
  })
  it('rejects empty items, bad dates, negative rates and bad links', () => {
    expect(invoiceInput.safeParse({ ...validInvoice, items: [] }).success).toBe(false)
    expect(invoiceInput.safeParse({ ...validInvoice, issue_date: '10-07-2026' }).success).toBe(false)
    expect(invoiceInput.safeParse({ ...validInvoice, tax_rate: -1 }).success).toBe(false)
    expect(invoiceInput.safeParse({ ...validInvoice, payment_link: 'not a url' }).success).toBe(false)
  })
})

describe('clientInput', () => {
  it('requires a name', () => {
    expect(clientInput.safeParse({ name: 'Vercel Inc.' }).success).toBe(true)
    expect(clientInput.safeParse({ name: '' }).success).toBe(false)
  })
})

describe('settingsInput', () => {
  it('validates prefix format and tax rate bounds', () => {
    expect(settingsInput.safeParse({ company_name: 'TWL', invoice_prefix: 'TWL', default_currency: 'USD', default_tax_rate: 18 }).success).toBe(true)
    expect(settingsInput.safeParse({ company_name: 'TWL', invoice_prefix: 'bad prefix!', default_currency: 'USD', default_tax_rate: 18 }).success).toBe(false)
    expect(settingsInput.safeParse({ company_name: 'TWL', invoice_prefix: 'TWL', default_currency: 'USD', default_tax_rate: 101 }).success).toBe(false)
  })
})
