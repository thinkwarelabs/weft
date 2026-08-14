'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { Client } from '@/lib/types'

type FormState = Record<string, string>

function empty(): FormState {
  return {
    name: '',
    email: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    tax_id: '',
  }
}

function toForm(c: Client): FormState {
  const f: FormState = {}
  for (const [k, v] of Object.entries(c)) f[k] = v === null ? '' : String(v)
  return f
}

export function ClientFormModal({ open, onClose, initial, onSaved }: {
  open: boolean
  onClose: () => void
  initial?: Client | null
  onSaved: (c: Client) => void
}) {
  // No reset effect. The parent renders this only while open and keys it by the
  // record being edited, so opening the form mounts a fresh component and these
  // initialisers run again. Syncing props into state inside an effect causes the
  // cascading render the react-hooks rule warns about, and leaves stale edits
  // visible for one frame after reopening.
  const [form, setForm] = useState<FormState>(() => (initial ? toForm(initial) : empty()))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setSaving(true)
    setErrors({})
    const payload = { ...form }
    delete (payload as Record<string, unknown>).id
    delete (payload as Record<string, unknown>).archived
    delete (payload as Record<string, unknown>).created_at
    const res = await fetch(initial ? `/api/clients/${initial.id}` : '/api/clients', {
      method: initial ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) {
      const d = await res.json()
      onSaved(d.client)
      onClose()
      toast(initial ? 'Client updated' : 'Client added')
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
      title={initial ? 'Edit client' : 'Add client'}
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
        <Field label="Email" error={errors.email}>
          <Input value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <Input value={form.phone} onChange={set('phone')} />
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
        <Field label="Tax ID" error={errors.tax_id}>
          <Input value={form.tax_id} onChange={set('tax_id')} />
        </Field>
      </div>
    </Modal>
  )
}
