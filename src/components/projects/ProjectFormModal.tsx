'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/legacy/Field'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/legacy/Modal'
import { useToast } from '@/components/legacy/Toast'
import type { Project } from '@/lib/types'

// Create only. A project's client can never change — moving one would silently
// re-scope its invoices, timeline and any live feedback links — so there is no
// edit path for the client here, and none in the API either.
export function ProjectFormModal({
  clientId,
  onClose,
  onSaved,
}: {
  clientId: string
  onClose: () => void
  onSaved: (p: Project) => void
}) {
  const [name, setName] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  async function save() {
    setSaving(true)
    setErrors({})
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, name: name.trim() }),
    })
    setSaving(false)
    if (res.ok) {
      const d = await res.json()
      onSaved(d.project)
      toast('Project created')
      return
    }
    const d = await res.json().catch(() => ({}))
    if (d.issues) {
      setErrors(
        Object.fromEntries(Object.entries(d.issues).map(([k, v]) => [k, (v as string[])[0]]))
      )
    }
    toast(d.error ?? 'Failed to create project', 'error')
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New project"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save} disabled={!name.trim()}>
            Create
          </Button>
        </>
      }
    >
      <Field label="Project name" error={errors.name}>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Website redesign"
          autoFocus
        />
      </Field>
      <p className="mt-3 text-sm text-zinc-500">
        Starts in <span className="font-medium">Onboarding</span> with the standard checklist.
      </p>
    </Modal>
  )
}
