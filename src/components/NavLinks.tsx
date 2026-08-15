'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

// Split out of AppShell because the active state needs the pathname, which is
// a client hook — and AppShell is a server component that renders a server
// action for sign-out. Keeping the boundary here means the shell stays on the
// server and only this list hydrates.
export interface NavItem {
  href: string
  label: string
}

export function NavLinks({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-3">
      {items.map((item) => {
        // "/" must match exactly or it would light up on every page; the rest
        // match their subtree so /clients/abc still highlights Clients.
        const active =
          item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
