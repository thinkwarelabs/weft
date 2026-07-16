import Image from 'next/image'
import Link from 'next/link'
import { ReactNode } from 'react'
import { auth, signOut } from '@/auth'

export async function AppShell({ children }: { children: ReactNode }) {
  const session = await auth()
  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-zinc-200 bg-white">
        <div className="px-6 py-6">
          <Image src="/logo.png" alt="Thinkware Labs" width={150} height={18} priority />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          <Link href="/" className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900">
            Invoices
          </Link>
          <Link href="/settings" className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900">
            Settings
          </Link>
        </nav>
        <div className="border-t border-zinc-100 px-6 py-4">
          <p className="truncate text-xs text-zinc-500" title={session?.user?.email ?? ''}>{session?.user?.email}</p>
          <form
            action={async () => {
              'use server'
              await signOut({ redirectTo: '/signin' })
            }}
          >
            <button type="submit" className="mt-2 cursor-pointer text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-900">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="ml-60 flex-1 px-10 py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  )
}
