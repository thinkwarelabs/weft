'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import type { ClientContact } from '@/lib/types'

export function ContactFormModal({
  clientId,
  initial,
  onClose,
  onSaved,
}: {
  clientId: string
  initial?: ClientContact | null
  onClose: () => void
  onSaved: (c: ClientContact) => void
}) {
  // Initialised from props directly; the parent keys this component by record,
  // so reopening mounts a fresh one rather than syncing state in an effect.
  const [name, setName] = useState(initial?.name ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  async function save() {
    setSaving(true)
    setErrors({})
    const editing = Boolean(initial)
    const res = await fetch(editing ? `/api/contacts/${initial!.id}` : '/api/contacts', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        editing
          ? { name: name.trim(), email: email.trim(), title: title.trim() }
          : { client_id: clientId, name: name.trim(), email: email.trim(), title: title.trim() }
      ),
    })
    setSaving(false)
    if (res.ok) {
      const d = await res.json()
      onSaved(d.contact)
      toast(editing ? 'Contact updated' : 'Contact added')
      return
    }
    const d = await res.json().catch(() => ({}))
    if (d.issues) {
      setErrors(
        Object.fromEntries(Object.entries(d.issues).map(([k, v]) => [k, (v as string[])[0]]))
      )
    }
    toast(d.error ?? 'Failed to save contact', 'error')
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? 'Edit contact' : 'Add contact'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save} disabled={!name.trim() || !email.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name" error={errors.name} className="col-span-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        </Field>
        <Field label="Role (optional)" error={errors.title}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Marketing lead"
          />
        </Field>
      </div>
      <p className="mt-4 text-sm text-zinc-500">
        This is who can be sent a feedback link — not where invoices go. Invoices use the billing
        email on the client record.
      </p>
    </Modal>
  )
}
