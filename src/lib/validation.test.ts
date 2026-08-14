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

  it('accepts a cuid client_id', () => {
    // Regression: this was `.uuid()` when the database was Supabase with
    // gen_random_uuid(). Prisma issues cuids, so every real client id failed
    // validation and surfaced as the misleading error "Pick a client".
    expect(
      invoiceInput.safeParse({ ...validInvoice, client_id: 'cmf3k2x9d0000qw8l7h2v1abc' }).success
    ).toBe(true)
  })

  it('still requires SOME client id', () => {
    expect(invoiceInput.safeParse({ ...validInvoice, client_id: '' }).success).toBe(false)
  })

  it('treats payment_link and notes as optional', () => {
    // Blank, whitespace, and entirely absent must all be accepted — an invoice
    // is valid with neither field.
    for (const patch of [
      { payment_link: '', notes: '' },
      { payment_link: '   ', notes: '   ' },
      {},
    ]) {
      const input = { ...validInvoice, ...patch }
      if (Object.keys(patch).length === 0) {
        delete (input as Record<string, unknown>).payment_link
        delete (input as Record<string, unknown>).notes
      }
      expect(invoiceInput.safeParse(input).success).toBe(true)
    }
  })

  it('still validates a payment_link that was actually supplied', () => {
    // A malformed link renders as a broken hyperlink on a document already sent
    // to a client, so "optional" must not mean "unchecked when present".
    expect(invoiceInput.safeParse({ ...validInvoice, payment_link: 'example.com' }).success).toBe(false)
    expect(
      invoiceInput.safeParse({ ...validInvoice, payment_link: 'https://pay.example.com/abc' }).success
    ).toBe(true)
  })
})

describe('clientInput', () => {
  it('requires a name', () => {
    expect(clientInput.safeParse({ name: 'Vercel Inc.' }).success).toBe(true)
    expect(clientInput.safeParse({ name: '' }).success).toBe(false)
  })

  it('documents the .partial() default hazard: absent keys still come back defaulted', () => {
    const parsed = clientInput.partial().parse({})
    // Every optional field gets defaulted to '' even though none were in the input —
    // this is why the PATCH route must not blindly spread `parsed.data` into an update.
    expect(parsed).toMatchObject({ address_line1: '', city: '', email: '' })
  })

  it('filtering parsed.data to keys present in the raw body prevents the wipe', () => {
    const body = { archived: true }
    const parsed = clientInput.partial().parse(body)
    const update = Object.fromEntries(Object.entries(parsed).filter(([k]) => k in body))
    expect(Object.keys(update)).toHaveLength(0)
  })
})

describe('settingsInput', () => {
  it('validates prefix format and tax rate bounds', () => {
    expect(settingsInput.safeParse({ company_name: 'TWL', invoice_prefix: 'TWL', default_currency: 'USD', default_tax_rate: 18 }).success).toBe(true)
    expect(settingsInput.safeParse({ company_name: 'TWL', invoice_prefix: 'bad prefix!', default_currency: 'USD', default_tax_rate: 18 }).success).toBe(false)
    expect(settingsInput.safeParse({ company_name: 'TWL', invoice_prefix: 'TWL', default_currency: 'USD', default_tax_rate: 101 }).success).toBe(false)
  })

  it('allows hyphenated prefixes and strips trailing hyphens', () => {
    const ok = settingsInput.safeParse({ company_name: 'TWL', invoice_prefix: 'TWL-2627-', default_currency: 'USD', default_tax_rate: 18 })
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data.invoice_prefix).toBe('TWL-2627')
    expect(settingsInput.safeParse({ company_name: 'TWL', invoice_prefix: '-TWL', default_currency: 'USD', default_tax_rate: 18 }).success).toBe(false)
    expect(settingsInput.safeParse({ company_name: 'TWL', invoice_prefix: 'A'.repeat(17), default_currency: 'USD', default_tax_rate: 18 }).success).toBe(false)
  })
})
