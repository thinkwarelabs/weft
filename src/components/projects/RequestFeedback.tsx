'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import type { ClientContact } from '@/lib/types'

interface RequestRow {
  id: string
  prompt: string
  created_at: string
  responded_at: string | null
  contact: { id: string; name: string; email: string; active: boolean }
  requested_by: string
}

export function RequestFeedback({
  projectId,
  clientId,
  onChanged,
}: {
  projectId: string
  clientId: string
  /** Sending a request adds an item to the timeline, which is a sibling. */
  onChanged: () => void
}) {
  const [requests, setRequests] = useState<RequestRow[] | null>(null)
  const [contacts, setContacts] = useState<ClientContact[]>([])
  const [reloadKey, setReloadKey] = useState(0)
  const [open, setOpen] = useState(false)
  const { toast } = useToast()

  const waiting = (requests ?? []).filter((r) => r.responded_at === null).length

  useEffect(() => {
    const ac = new AbortController()
    Promise.all([
      fetch(`/api/projects/${projectId}/feedback-requests`, { signal: ac.signal }).then((r) =>
        r.json()
      ),
      fetch(`/api/contacts?clientId=${clientId}`, { signal: ac.signal }).then((r) => r.json()),
    ])
      .then(([reqs, cs]) => {
        setRequests(reqs.requests ?? [])
        setContacts(cs.contacts ?? [])
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        toast('Failed to load feedback requests', 'error')
      })
    return () => ac.abort()
  }, [projectId, clientId, reloadKey, toast])

  return (
    <Card title="Client feedback">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-zinc-500">
          Sends a private link that opens this project and nothing else. It expires in 14 days, and
          deactivating the contact switches it off sooner.
        </p>
        <Button onClick={() => setOpen(true)} disabled={contacts.length === 0}>
          Request feedback
        </Button>
      </div>

      {contacts.length === 0 && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Add a contact on the client first — a link is issued to a person, not to a company.
        </p>
      )}

      {/* The requests themselves are no longer listed here — they appear on the
          timeline below, with each client reply nested under the thing it
          answers. This card is just the action and its preconditions. */}
      {waiting > 0 && (
        <p className="mt-3 text-sm text-zinc-500">
          {waiting === 1 ? '1 request is' : `${waiting} requests are`} still waiting for a reply —
          see the timeline below.
        </p>
      )}

      {open && (
        <RequestModal
          projectId={projectId}
          contacts={contacts}
          onClose={() => setOpen(false)}
          onSent={() => {
            setOpen(false)
            setReloadKey((k) => k + 1)
            onChanged()
          }}
        />
      )}
    </Card>
  )
}

function RequestModal({
  projectId,
  contacts,
  onClose,
  onSent,
}: {
  projectId: string
  contacts: ClientContact[]
  onClose: () => void
  onSent: () => void
}) {
  const [contactId, setContactId] = useState(contacts[0]?.id ?? '')
  const [prompt, setPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  async function send() {
    setSaving(true)
    const res = await fetch(`/api/projects/${projectId}/feedback-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contactId, prompt: prompt.trim() }),
    })
    setSaving(false)
    if (res.ok) {
      onSent()
      toast('Feedback link sent')
      return
    }
    const d = await res.json().catch(() => ({}))
    // A send failure revokes the token server-side, so nothing is left live.
    toast(d.error ?? 'Could not send the link', 'error')
  }

  const selected = contacts.find((c) => c.id === contactId)

  return (
    <Modal
      open
      onClose={onClose}
      title="Request feedback"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button loading={saving} onClick={send} disabled={!contactId || !prompt.trim()}>
            Send link
          </Button>
        </>
      }
    >
      <Field label="Send to">
        <Select
          value={contactId}
          onChange={setContactId}
          options={contacts.map((c) => ({ value: c.id, label: `${c.name} · ${c.email}` }))}
        />
      </Field>

      <div className="mt-4">
        <Field label="What do you want feedback on?">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="We've pushed the new homepage to staging — does the tone feel right?"
          />
        </Field>
      </div>

      {selected && (
        <p className="mt-4 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          {selected.email} will receive a private link to this project only. They can read
          milestones and their own feedback — never invoices, other clients, or anything else.
        </p>
      )}
    </Modal>
  )
}
