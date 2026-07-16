import { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Card({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-zinc-200 bg-white p-6 shadow-sm', className)}>
      {title && <h2 className="mb-4 text-base font-semibold tracking-tight">{title}</h2>}
      {children}
    </section>
  )
}
