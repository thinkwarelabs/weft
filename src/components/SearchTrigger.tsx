'use client'
import { useSyncExternalStore } from 'react'

// A visible way into the command palette.
//
// It dispatches the same keyboard event the palette already listens for rather
// than lifting its open state into a context. One listener, one source of
// truth, and clicking here is indistinguishable from pressing the shortcut.
// `navigator` does not exist on the server, so this cannot be read during
// render without a hydration mismatch — and setting it from an effect is the
// cascading-render pattern the lint rule (rightly) rejects.
//
// useSyncExternalStore is built for exactly this: a server snapshot of false,
// a client snapshot read on demand. It never subscribes, because the platform
// does not change mid-session.
const noop = () => () => {}
const isMacClient = () => /Mac|iPhone|iPad/.test(navigator.platform)
const isMacServer = () => false

export function SearchTrigger() {
  const mac = useSyncExternalStore(noop, isMacClient, isMacServer)

  function open() {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true, bubbles: true })
    )
  }

  return (
    <button
      type="button"
      onClick={open}
      className="border-border text-muted-foreground hover:bg-muted/60 flex w-full cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="flex-1 text-left">Search</span>
      <kbd className="text-muted-foreground/70 shrink-0 text-[11px]">{mac ? '⌘' : 'Ctrl'}K</kbd>
    </button>
  )
}
