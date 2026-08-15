'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/legacy/Card'
import { Field } from '@/components/legacy/Field'
import { Input } from '@/components/legacy/Input'
import { Select } from '@/components/legacy/Select'
import { Spinner } from '@/components/legacy/Spinner'
import { Textarea } from '@/components/legacy/Textarea'
import { useToast } from '@/components/legacy/Toast'
import { BusinessProfile } from '@/lib/types'

type FormState = Record<string, string>
const CURRENCIES = ['USD', 'INR', 'EUR', 'GBP', 'AED', 'AUD', 'CAD', 'SGD']

function toForm(p: BusinessProfile): FormState {
  const f: FormState = {}
  for (const [k, v] of Object.entries(p)) f[k] = v === null ? '' : String(v)
  return f
}

export function BusinessProfileForm() {
  const [form, setForm] = useState<FormState | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => setForm(toForm(d.profile)))
      .catch(() => toast('Failed to load profile', 'error'))
  }, [toast])

  if (!form) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner className="size-10 text-zinc-400" /></div>

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f!, [k]: e.target.value }))

  async function save() {
    setSaving(true)
    setErrors({})
    const payload = { ...form, default_tax_rate: Number(form!.default_tax_rate || 0) }
    delete (payload as Record<string, unknown>).id
    delete (payload as Record<string, unknown>).next_invoice_number
    delete (payload as Record<string, unknown>).updated_at
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) { toast('Profile saved') }
    else {
      const d = await res.json().catch(() => ({}))
      if (d.issues) setErrors(Object.fromEntries(Object.entries(d.issues).map(([k, v]) => [k, (v as string[])[0]])))
      toast(d.error ?? 'Failed to save', 'error')
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Card title="Company">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Company name" error={errors.company_name} className="col-span-2">
            <Input value={form.company_name} onChange={set('company_name')} />
          </Field>
          <Field label="Address line 1" error={errors.address_line1} className="col-span-2">
            <Input value={form.address_line1} onChange={set('address_line1')} />
          </Field>
          <Field label="Address line 2" error={errors.address_line2} className="col-span-2">
            <Input value={form.address_line2} onChange={set('address_line2')} />
          </Field>
          <Field label="City" error={errors.city}>
            <Input value={form.city} onChange={set('city')} />
          </Field>
          <Field label="State" error={errors.state}>
            <Input value={form.state} onChange={set('state')} />
          </Field>
          <Field label="Postal code" error={errors.postal_code}>
            <Input value={form.postal_code} onChange={set('postal_code')} />
          </Field>
          <Field label="Country" error={errors.country}>
            <Input value={form.country} onChange={set('country')} />
          </Field>
          <Field label="Email" error={errors.email}>
            <Input value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Phone" error={errors.phone}>
            <Input value={form.phone} onChange={set('phone')} />
          </Field>
        </div>
      </Card>

      <Card title="Tax">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tax / VAT / GST ID" error={errors.tax_id}>
            <Input value={form.tax_id} onChange={set('tax_id')} />
          </Field>
          <Field label="Legal note" error={errors.legal_note} className="col-span-2">
            <Textarea
              value={form.legal_note ?? ''}
              onChange={set('legal_note')}
              placeholder="Optional note printed on invoices"
            />
          </Field>
        </div>
      </Card>

      <Card title="Bank details">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Account holder name" error={errors.bank_account_name}>
            <Input value={form.bank_account_name} onChange={set('bank_account_name')} />
          </Field>
          <Field label="Bank name" error={errors.bank_name}>
            <Input value={form.bank_name} onChange={set('bank_name')} />
          </Field>
          <Field label="Account number" error={errors.bank_account_number}>
            <Input value={form.bank_account_number} onChange={set('bank_account_number')} />
          </Field>
          <Field label="IFSC" error={errors.bank_ifsc}>
            <Input value={form.bank_ifsc} onChange={set('bank_ifsc')} />
          </Field>
        </div>
      </Card>

      <Card title="Invoicing defaults">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Invoice prefix" error={errors.invoice_prefix}>
            <Input value={form.invoice_prefix} onChange={set('invoice_prefix')} />
          </Field>
          <Field label="Default currency" error={errors.default_currency}>
            <Select
              value={form.default_currency}
              onChange={(v) => setForm((f) => ({ ...f!, default_currency: v }))}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
          </Field>
          <Field label="Default tax label" error={errors.default_tax_label}>
            <Input value={form.default_tax_label} onChange={set('default_tax_label')} />
          </Field>
          <Field label="Default tax rate" error={errors.default_tax_rate}>
            <Input type="number" step="0.01" value={form.default_tax_rate} onChange={set('default_tax_rate')} />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button loading={saving} onClick={save}>Save changes</Button>
      </div>
    </div>
  )
}
