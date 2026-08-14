import type { ReactNode } from 'react'

// The client surface. Deliberately shares NOTHING with the internal shell — no
// AppShell, no nav, no sign-out, no links anywhere except this project.
//
// There is no auth check here. Authorization happens inside each route via
// lib/client-scope, which re-reads the token row on every request. A layout
// guard would be a second place for the rule to live, and a second place for it
// to be wrong.
export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto w-full max-w-2xl px-6 py-12">{children}</main>
      <footer className="pb-12 text-center text-xs text-zinc-400">
        Thinkware Labs
      </footer>
    </div>
  )
}
