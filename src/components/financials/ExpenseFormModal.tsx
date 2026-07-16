'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import { todayISO } from '@/lib/dates'
import { Expense } from '@/lib/types'

const CURRENCIES = ['USD', 'INR', 'EUR', 'GBP', 'AED', 'AUD', 'CAD', 'SGD']
const PAYER_OPTIONS = [
  { value: 'company', label: 'Company account' },
  { value: 'person', label: 'Other person' },
]

interface FormState {
  name: string
  expense_type: string
  amount: string
  currency: string
  payer_type: 'company' | 'person'
  payer_name: string
  expense_date: string
  note: string
}

function empty(defaultCurrency: string): FormState {
  return {
    name: '',
    expense_type: '',
    amount: '',
    currency: defaultCurrency,
    payer_type: 'company',
    payer_name: '',
    expense_date: todayISO(),
    note: '',
  }
}

function toForm(e: Expense): FormState {
  return {
    name: e.name,
    expense_type: e.expense_type ?? '',
    amount: String(e.amount),
    currency: e.currency,
    payer_type: e.payer_type,
    payer_name: e.payer_name ?? '',
    expense_date: e.expense_date,
    note: e.note ?? '',
  }
}

export function ExpenseFormModal({ open, onClose, initial, onSaved, knownTypes, defaultCurrency }: {
  open: boolean
  onClose: () => void
  initial?: Expense | null
  onSaved: (e: Expense) => void
  knownTypes: string[]
  defaultCurrency: string
}) {
  const [form, setForm] = useState<FormState>(empty(defaultCurrency))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    setForm(initial ? toForm(initial) : empty(defaultCurrency))
    setErrors({})
  }, [initial, open, defaultCurrency])

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setSaving(true)
    setErrors({})
    const payload = {
      name: form.name,
      expense_type: form.expense_type,
      amount: Number(form.amount),
      currency: form.currency,
      payer_type: form.payer_type,
      payer_name: form.payer_type === 'person' ? form.payer_name : '',
      expense_date: form.expense_date,
      note: form.note,
    }
    const res = await fetch(initial ? `/api/expenses/${initial.id}` : '/api/expenses', {
      method: initial ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) {
      const d = await res.json()
      onSaved(d.expense)
      onClose()
      toast(initial ? 'Expense updated' : 'Expense added')
    } else {
      const d = await res.json().catch(() => ({}))
      if (d.issues) setErrors(Object.fromEntries(Object.entries(d.issues).map(([k, v]) => [k, (v as string[])[0]])))
      toast(d.error ?? 'Failed to save', 'error')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit expense' : 'Add expense'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button loading={saving} onClick={save}>Save</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name" error={errors.name} className="col-span-2">
          <Input value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Type" error={errors.expense_type} className="col-span-2">
          <Input value={form.expense_type} onChange={set('expense_type')} list="expense-type-suggestions" />
          <datalist id="expense-type-suggestions">
            {knownTypes.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>
        <Field label="Amount" error={errors.amount}>
          <Input type="number" step="0.01" min="0" value={form.amount} onChange={set('amount')} />
        </Field>
        <Field label="Currency" error={errors.currency}>
          <Select
            value={form.currency}
            onChange={(v) => setForm((f) => ({ ...f, currency: v }))}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          />
        </Field>
        <Field label="Paid by" error={errors.payer_type}>
          <Select
            value={form.payer_type}
            onChange={(v) => setForm((f) => ({ ...f, payer_type: v as 'company' | 'person' }))}
            options={PAYER_OPTIONS}
          />
        </Field>
        {form.payer_type === 'person' && (
          <Field label="Person name" error={errors.payer_name}>
            <Input value={form.payer_name} onChange={set('payer_name')} />
          </Field>
        )}
        <Field label="Expense date" error={errors.expense_date}>
          <Input type="date" value={form.expense_date} onChange={set('expense_date')} />
        </Field>
        <Field label="Note" error={errors.note} className="col-span-2">
          <Textarea value={form.note} onChange={set('note')} />
        </Field>
      </div>
    </Modal>
  )
}
