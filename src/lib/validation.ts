import { z } from 'zod'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
const optionalText = z.string().trim().optional().default('')

export const clientInput = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  address_line1: optionalText,
  address_line2: optionalText,
  city: optionalText,
  state: optionalText,
  postal_code: optionalText,
  country: optionalText,
  email: z.string().trim().email().optional().or(z.literal('')).default(''),
  phone: optionalText,
  tax_id: optionalText,
})

export const invoiceItemInput = z.object({
  description: z.string().trim().min(1, 'Description is required'),
  period: optionalText,
  qty: z.number().positive('Qty must be > 0'),
  unit_price: z.number().min(0, 'Price must be >= 0'),
  gst_included: z.boolean().default(true),
})

export const invoiceInput = z.object({
  client_id: z.string().uuid('Pick a client'),
  issue_date: isoDate,
  due_date: isoDate,
  currency: z.string().length(3),
  tax_label: optionalText,
  tax_rate: z.number().min(0).max(100),
  payment_link: z.string().trim().url().optional().or(z.literal('')).default(''),
  notes: optionalText,
  items: z.array(invoiceItemInput).min(1, 'Add at least one item'),
})

export const paymentInput = z.object({
  payment_date: isoDate,
  amount_received: z.number().min(0),
  tds_amount: z.number().min(0).default(0),
  payment_reference: optionalText,
})

export const settingsInput = z.object({
  company_name: z.string().trim().min(1, 'Company name is required'),
  address_line1: optionalText,
  address_line2: optionalText,
  city: optionalText,
  state: optionalText,
  postal_code: optionalText,
  country: optionalText,
  email: z.string().trim().email().optional().or(z.literal('')).default(''),
  phone: optionalText,
  tax_id: optionalText,
  legal_note: optionalText,
  bank_account_name: optionalText,
  bank_name: optionalText,
  bank_account_number: optionalText,
  bank_ifsc: optionalText,
  bank_swift: optionalText,
  invoice_prefix: z.string().trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,15}$/, '1-16 letters/digits/hyphens, must start with a letter or digit')
    .transform((s) => s.toUpperCase().replace(/-+$/, '')),
  default_currency: z.string().length(3),
  default_tax_label: optionalText,
  default_tax_rate: z.number().min(0).max(100),
})

// Base shape without the cross-field refine, so a PATCH route can call `.partial()` on it.
// Zod v4 throws at runtime ("`.partial()` cannot be used on object schemas containing
// refinements") if you call `.partial()` on a schema built with `.superRefine()`, so the
// refine must be layered on top of the plain object rather than baked into `expenseInput`.
export const expenseObjectSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  expense_type: optionalText,
  amount: z.number().positive('Amount must be > 0'),
  currency: z.string().length(3),
  payer_type: z.enum(['company', 'person']),
  payer_name: optionalText,
  expense_date: isoDate,
  note: optionalText,
})

function requirePayerNameForPerson(data: { payer_type: string; payer_name: string }, ctx: z.RefinementCtx) {
  if (data.payer_type === 'person' && data.payer_name.trim() === '') {
    ctx.addIssue({
      code: 'custom',
      path: ['payer_name'],
      message: 'Payer name is required when payer type is person',
    })
  }
}

export const expenseInput = expenseObjectSchema.superRefine(requirePayerNameForPerson)

// For PATCH: partial shape only, no cross-field refine (see note above). The route is
// responsible for checking the person/payer_name rule against the merged (existing + patch) data.
export const expensePatchInput = expenseObjectSchema.partial()

export type ClientInput = z.infer<typeof clientInput>
export type InvoiceItemInput = z.infer<typeof invoiceItemInput>
export type InvoiceInput = z.infer<typeof invoiceInput>
export type SettingsInput = z.infer<typeof settingsInput>
export type ExpenseInput = z.infer<typeof expenseInput>
export type ExpensePatchInput = z.infer<typeof expensePatchInput>
export type PaymentInput = z.infer<typeof paymentInput>
