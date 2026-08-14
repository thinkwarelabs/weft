'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { Client } from '@/lib/types'
import { ClientFormModal } from './ClientFormModal'

export function ClientsManager() {
  const [rows, setRows] = useState<Client[] | null>(null)
  const [total, setTotal] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('') // raw input
  const [q, setQ] = useState('') // debounced query used by the fetch
  const [pending, setPending] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [archiving, setArchiving] = useState<Client | null>(null)
  const { toast } = useToast()

  // Debounce the search box into `q`, resetting to the first page when it changes.
  useEffect(() => {
    const t = setTimeout(() => {
      setPending(true)
      setPage(1)
      setQ(search.trim())
    }, 250)
    return () => clearTimeout(t)
  }, [search])

  // Fetch a page whenever page/size/query changes or a mutation bumps reloadTick.
  useEffect(() => {
    let ignore = false
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (q) params.set('q', q)
    fetch(`/api/clients?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('request failed'))))
      .then((d) => {
        if (ignore) return
        setRows(d.clients ?? [])
        setTotal(d.total ?? 0)
        setPageCount(d.pageCount ?? 1)
      })
      .catch(() => {
        if (!ignore) toast('Failed to load clients', 'error')
      })
      .finally(() => {
        if (!ignore) setPending(false)
      })
    return () => {
      ignore = true
    }
  }, [page, pageSize, q, reloadTick, toast])

  function reload() {
    setPending(true)
    setReloadTick((t) => t + 1)
  }

  function goToPage(next: number) {
    setPending(true)
    setPage(next)
  }

  function changePageSize(size: number) {
    setPending(true)
    setPage(1)
    setPageSize(size)
  }

  function openAdd() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(c: Client) {
    setEditing(c)
    setModalOpen(true)
  }

  async function archive() {
    if (!archiving) return
    const res = await fetch(`/api/clients/${archiving.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: true }),
    })
    if (res.ok) {
      toast('Client archived')
      reload()
    } else {
      toast('Failed to archive client', 'error')
    }
  }

  if (rows === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="size-10 text-zinc-400" />
      </div>
    )
  }

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

      {total === 0 ? (
        q ? (
          <EmptyState title="No matching clients" hint="Try a different search." />
        ) : (
          <EmptyState
            title="No clients yet"
            hint="Add your first client to start invoicing."
            action={<Button onClick={openAdd}>Add client</Button>}
          />
        )
      ) : (
        <>
          <Card className="p-0 overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-zinc-500 border-b border-zinc-200 bg-zinc-50">
                  <th className="w-full px-4 py-3">Name</th>
                  <th className="whitespace-nowrap px-4 py-3">Email</th>
                  <th className="whitespace-nowrap px-4 py-3">Location</th>
                  <th className="whitespace-nowrap px-4 py-3">Tax ID</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 text-sm border-b border-zinc-100">
                      <Link href={`/clients/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm border-b border-zinc-100">{c.email || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm border-b border-zinc-100">
                      {[c.city, c.country].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm border-b border-zinc-100">{c.tax_id || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm border-b border-zinc-100">
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

          <Pagination
            page={page}
            pageCount={pageCount}
            total={total}
            pageSize={pageSize}
            onPageChange={goToPage}
            onPageSizeChange={changePageSize}
            disabled={pending}
            singular="client"
            plural="clients"
          />
        </>
      )}

      {/* Mounted only while open and keyed by the record, so each open starts
          from fresh state instead of an effect syncing props into state. */}
      {modalOpen && (
        <ClientFormModal
          key={editing?.id ?? 'new'}
          open
          onClose={() => setModalOpen(false)}
          initial={editing}
          onSaved={reload}
        />
      )}

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
