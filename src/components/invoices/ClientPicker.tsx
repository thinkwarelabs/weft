'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { ClientFormModal } from '@/components/settings/ClientFormModal'
import { Client } from '@/lib/types'

export function ClientPicker({ clients, value, onChange, onClientAdded, error }: {
  clients: Client[]
  value: string
  onChange: (id: string) => void
  onClientAdded: (c: Client) => void
  error?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div className="flex gap-2">
        <Select
          value={value}
          onChange={onChange}
          placeholder="Select a client…"
          options={clients.map((c) => ({ value: c.id, label: c.name }))}
        />
        <Button type="button" variant="secondary" className="shrink-0 whitespace-nowrap" onClick={() => setOpen(true)}>
          New client
        </Button>
      </div>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
      <ClientFormModal
        open={open}
        onClose={() => setOpen(false)}
        initial={null}
        onSaved={(c) => { onClientAdded(c); onChange(c.id) }}
      />
    </div>
  )
}
