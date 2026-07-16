import { ReactNode } from 'react'

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
      <p className="text-sm font-medium text-zinc-900">{title}</p>
      {hint && <p className="text-sm text-zinc-500">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
