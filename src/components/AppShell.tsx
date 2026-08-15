import Image from 'next/image'
import Link from 'next/link'
import { ReactNode } from 'react'
import { signOut } from '@/auth'

// Presentational only.
//
// This used to call auth() and isAuditAdmin() itself. It no longer does: the
// (internal) layout already resolved the actor through requireInternal(), and a
// component that re-derives authorization is a component that can disagree with
// the guard. It takes what it needs as props and renders.
export interface AppShellActor {
  name: string | null
  email: string
  image: string | null
}

// Ordered by how the studio actually works: what needs me, who we work for,
// what we're building, then the money. Invoices used to be the front door
// because this repo was the invoicing app — that was a fossil, not a decision.
const NAV = [
  { href: '/', label: 'Home' },
  { href: '/clients', label: 'Clients' },
  { href: '/projects', label: 'Projects' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/financials', label: 'Financials' },
  { href: '/ideas', label: 'Ideas' },
  { href: '/settings', label: 'Settings' },
] as const

const linkClass =
  'rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900'

export function AppShell({
  actor,
  showAudit,
  children,
}: {
  actor: AppShellActor
  showAudit: boolean
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-zinc-200 bg-white">
        <div className="flex items-center gap-2.5 px-6 py-6">
          <Image src="/logo.png" alt="Thinkware Labs" width={150} height={18} priority />
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass}>
              {item.label}
            </Link>
          ))}
          {showAudit && (
            <Link href="/audit" className={linkClass}>
              Audit log
            </Link>
          )}
        </nav>

        <div className="flex items-center justify-between gap-2 border-t border-zinc-100 px-4 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {actor.image ? (
              <Image
                src={actor.image}
                alt=""
                width={32}
                height={32}
                className="shrink-0 rounded-full"
              />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-medium text-zinc-600">
                {(actor.name ?? actor.email).charAt(0).toUpperCase()}
              </span>
            )}
            <div className="group relative min-w-0">
              {actor.name && (
                <p className="truncate text-xs font-medium text-zinc-900">{actor.name}</p>
              )}
              <p className="truncate text-xs text-zinc-500">{actor.email}</p>
              <span className="pointer-events-none absolute bottom-full left-0 mb-1.5 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100">
                {actor.email}
              </span>
            </div>
          </div>

          <form
            action={async () => {
              'use server'
              await signOut({ redirectTo: '/signin' })
            }}
          >
            <button
              type="submit"
              className="shrink-0 cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="ml-60 flex-1 px-10 py-10">{children}</main>
    </div>
  )
}
