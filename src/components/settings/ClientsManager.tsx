'use client'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { Client } from '@/lib/types'
import { ClientFormModal } from './ClientFormModal'

function sortByName(clients: Client[]): Client[] {
  return [...clients].sort((a, b) => a.name.localeCompare(b.name))
}

export function ClientsManager() {
  const [clients, setClients] = useState<Client[] | null>(null)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [archiving, setArchiving] = useState<Client | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetch('/api/clients')
      .then((r) => r.json())
      .then((d) => setClients(sortByName(d.clients)))
      .catch(() => toast('Failed to load clients', 'error'))
  }, [toast])

  const filtered = useMemo(() => {
    if (!clients) return []
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q)
    )
  }, [clients, search])

  function openAdd() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(c: Client) {
    setEditing(c)
    setModalOpen(true)
  }

  function onSaved(c: Client) {
    setClients((prev) => sortByName([...(prev ?? []).filter((x) => x.id !== c.id), c]))
  }

  async function archive() {
    if (!archiving) return
    const res = await fetch(`/api/clients/${archiving.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: true }),
    })
    if (res.ok) {
      setClients((prev) => (prev ?? []).filter((c) => c.id !== archiving.id))
      toast('Client archived')
    } else {
      toast('Failed to archive client', 'error')
    }
  }

  if (!clients) return <div className="flex justify-center py-20"><Spinner className="size-6 text-zinc-400" /></div>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients…"
          className="max-w-xs"
        />
        <Button onClick={openAdd}>Add client</Button>
      </div>

      {filtered.length === 0 ? (
        clients.length === 0 ? (
          <EmptyState
            title="No clients yet"
            hint="Add your first client to start invoicing."
            action={<Button onClick={openAdd}>Add client</Button>}
          />
        ) : (
          <EmptyState title="No matching clients" hint="Try a different search." />
        )
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-zinc-500 border-b border-zinc-200 bg-zinc-50">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Tax ID</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 text-sm border-b border-zinc-100">{c.name}</td>
                  <td className="px-4 py-3 text-sm border-b border-zinc-100">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-sm border-b border-zinc-100">
                    {[c.city, c.country].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm border-b border-zinc-100">{c.tax_id || '—'}</td>
                  <td className="px-4 py-3 text-sm border-b border-zinc-100">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" className="h-7 px-2" onClick={() => openEdit(c)}>Edit</Button>
                      <Button variant="ghost" className="h-7 px-2" onClick={() => setArchiving(c)}>Archive</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ClientFormModal open={modalOpen} onClose={() => setModalOpen(false)} initial={editing} onSaved={onSaved} />

      <ConfirmDialog
        open={!!archiving}
        onClose={() => setArchiving(null)}
        onConfirm={archive}
        title="Archive client"
        message="Archived clients disappear from pickers but stay on existing invoices."
        confirmLabel="Archive"
        danger
      />
    </div>
  )
}
