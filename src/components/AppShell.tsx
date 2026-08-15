import Image from 'next/image'
import { ReactNode } from 'react'
import { signOut } from '@/auth'
import { NavLinks, type NavItem } from '@/components/NavLinks'
import { CommandPalette } from '@/components/CommandPalette'
import { SearchTrigger } from '@/components/SearchTrigger'
import { Button } from '@/components/ui/button'

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
const NAV: readonly NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/clients', label: 'Clients' },
  { href: '/projects', label: 'Projects' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/financials', label: 'Financials' },
  { href: '/ideas', label: 'Ideas' },
  { href: '/settings', label: 'Settings' },
]

const AUDIT: NavItem = { href: '/audit', label: 'Audit log' }

export function AppShell({
  actor,
  showAudit,
  children,
}: {
  actor: AppShellActor
  showAudit: boolean
  children: ReactNode
}) {
  const items = showAudit ? [...NAV, AUDIT] : NAV

  return (
    <div className="bg-background flex min-h-screen">
      <aside className="border-border fixed inset-y-0 left-0 flex w-60 flex-col border-r bg-white">
        <div className="flex items-center gap-2.5 px-6 py-6">
          <Image src="/logo.png" alt="Thinkware Labs" width={150} height={18} priority />
        </div>

        {/* Opens the same palette as Cmd-K. Without a visible affordance the
            shortcut is a secret only the person who built it knows about. */}
        <div className="px-3 pb-3">
          <SearchTrigger />
        </div>

        <NavLinks items={items} />

        <div className="border-border flex items-center justify-between gap-2 border-t px-4 py-4">
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
              <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium">
                {(actor.name ?? actor.email).charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              {actor.name && (
                <p className="text-foreground truncate text-xs font-medium">{actor.name}</p>
              )}
              <p className="text-muted-foreground truncate text-xs">{actor.email}</p>
            </div>
          </div>

          <form
            action={async () => {
              'use server'
              await signOut({ redirectTo: '/signin' })
            }}
          >
            <Button type="submit" variant="ghost" size="xs">
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <main className="ml-60 flex-1 px-10 py-10">{children}</main>

      <CommandPalette />
    </div>
  )
}
