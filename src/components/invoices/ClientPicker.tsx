'use client'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ClientFormModal } from '@/components/settings/ClientFormModal'
import { cn } from '@/lib/cn'
import { Client } from '@/lib/types'

// Async client picker: searches /api/clients server-side as you type instead of
// loading every client up front. The parent owns the selected client (needed
// for GST/intra-state logic), so this component just surfaces the choice.
export function ClientPicker({ selected, onSelect, error }: {
  selected: Client | null
  onSelect: (c: Client) => void
  error?: string
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Client[]>([])
  const rootRef = useRef<HTMLDivElement>(null)

  // Debounced search while the dropdown is open.
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      const params = new URLSearchParams({ pageSize: '20' })
      if (query.trim()) params.set('q', query.trim())
      fetch(`/api/clients?${params.toString()}`)
        .then((r) => r.json())
        .then((d) => setResults(d.clients ?? []))
        .catch(() => setResults([]))
    }, 200)
    return () => clearTimeout(t)
  }, [open, query])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function pick(c: Client) {
    onSelect(c)
    setQuery('')
    setOpen(false)
  }

  return (
    <div>
      <div className="flex gap-2">
        <div ref={rootRef} className="relative w-full">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={open}
            className={cn(
              'flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-left text-sm transition-colors focus:border-zinc-900 focus:outline-none',
              open && 'border-zinc-900'
            )}
          >
            <span className={cn('truncate', !selected && 'text-zinc-400')}>
              {selected ? selected.name : 'Select a client…'}
            </span>
            <svg
              width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden
              className={cn('shrink-0 text-zinc-500 transition-transform duration-150', open && 'rotate-180')}
            >
              <path d="M4.646 6.146a.5.5 0 0 1 .708 0L8 8.793l2.646-2.647a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z" />
            </svg>
          </button>
          {open && (
            <div className="dropdown-panel absolute z-30 mt-1.5 w-full rounded-lg border border-zinc-200 bg-white p-1 shadow-lg">
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search clients…"
                className="mb-1"
              />
              <ul role="listbox" className="max-h-56 overflow-y-auto">
                {results.length === 0 ? (
                  <li className="px-2.5 py-2 text-sm text-zinc-400">No clients found</li>
                ) : (
                  results.map((c) => (
                    <li
                      key={c.id}
                      role="option"
                      aria-selected={c.id === selected?.id}
                      onClick={() => pick(c)}
                      className={cn(
                        'flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100',
                        c.id === selected?.id && 'bg-zinc-100 text-zinc-900'
                      )}
                    >
                      <span className="truncate">{c.name}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>
        <Button type="button" variant="secondary" className="shrink-0 whitespace-nowrap" onClick={() => setModalOpen(true)}>
          New client
        </Button>
      </div>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
      <ClientFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={null}
        onSaved={(c) => pick(c)}
      />
    </div>
  )
}
