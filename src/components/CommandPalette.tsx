'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import type { SearchHit, SearchKind } from '@/lib/search'

const KIND_LABEL: Record<SearchKind, string> = {
  client: 'Client',
  project: 'Project',
  invoice: 'Invoice',
  timeline: 'Timeline',
  idea: 'Idea',
}

// Static destinations, so the palette is useful before you type anything.
const ACTIONS: { title: string; href: string; keywords: string }[] = [
  { title: 'New invoice', href: '/invoices/new', keywords: 'create bill' },
  { title: 'Clients', href: '/clients', keywords: 'customers' },
  { title: 'Projects', href: '/projects', keywords: 'engagements work' },
  { title: 'Invoices', href: '/invoices', keywords: 'billing' },
  { title: 'Financials', href: '/financials', keywords: 'revenue expenses gst' },
  { title: 'Ideas', href: '/ideas', keywords: 'notes board' },
  { title: 'Settings', href: '/settings', keywords: 'business profile' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor] = useState(0)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  // Cmd/Ctrl-K anywhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Debounced search. Aborting on change means a slow response for an earlier
  // keystroke cannot overwrite results for a later one.
  // Nothing is set synchronously in here. The short-query case is DERIVED
  // below rather than written to state, and `loading` flips inside the
  // debounce callback, which is already async. Setting state in an effect body
  // is the cascading-render pattern the react-hooks rule rejects.
  useEffect(() => {
    if (!open) return
    const term = query.trim()
    if (term.length < 2) return

    const ac = new AbortController()
    const t = setTimeout(() => {
      setLoading(true)
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ac.signal })
        .then((r) => r.json())
        .then((d) => {
          setHits(d.hits ?? [])
          setCursor(0)
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }, 180)

    return () => {
      clearTimeout(t)
      ac.abort()
    }
  }, [query, open])

  // Stale results from a previous query must not show under a shorter one.
  const tooShort = query.trim().length < 2
  const visibleHits = tooShort ? null : hits

  const actions =
    query.trim().length === 0
      ? ACTIONS
      : ACTIONS.filter((a) =>
          `${a.title} ${a.keywords}`.toLowerCase().includes(query.trim().toLowerCase())
        )

  const rows: { key: string; title: string; subtitle: string | null; label: string; href: string }[] =
    [
      ...actions.map((a) => ({
        key: `action:${a.href}`,
        title: a.title,
        subtitle: null,
        label: 'Go to',
        href: a.href,
      })),
      ...(visibleHits ?? []).map((h) => ({
        key: `${h.kind}:${h.id}`,
        title: h.title,
        subtitle: h.subtitle,
        label: KIND_LABEL[h.kind],
        href: h.href,
      })),
    ]

  function go(href: string) {
    setOpen(false)
    setQuery('')
    setHits(null)
    router.push(href)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, rows.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const row = rows[cursor]
      if (row) go(row.href)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[20%] max-w-xl translate-y-0 gap-0 p-0" showCloseButton={false}>
        {/* Required for the dialog to be announced, but the visible label is
            the input's placeholder. */}
        <DialogTitle className="sr-only">Search Weft</DialogTitle>

        <div className="border-border flex items-center gap-3 border-b px-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-muted-foreground shrink-0">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search clients, projects, invoices, notes…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {loading && !tooShort && <Spinner className="text-muted-foreground size-4 shrink-0" />}
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5">
          {rows.length === 0 ? (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">
              {tooShort ? 'Type to search' : 'Nothing found'}
            </p>
          ) : (
            <ul>
              {rows.map((row, i) => (
                <li key={row.key}>
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(row.href)}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm',
                      i === cursor ? 'bg-muted' : 'hover:bg-muted/60'
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{row.title}</span>
                    {row.subtitle && (
                      <span className="text-muted-foreground shrink-0 truncate text-xs">
                        {row.subtitle}
                      </span>
                    )}
                    <span className="text-muted-foreground shrink-0 text-[11px] uppercase tracking-wide">
                      {row.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-border text-muted-foreground flex items-center gap-3 border-t px-4 py-2 text-[11px]">
          <span>↑↓ to move</span>
          <span>↵ to open</span>
          <span>esc to close</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
