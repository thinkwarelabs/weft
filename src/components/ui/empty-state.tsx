import type { ReactNode } from 'react'

// Local design-system component; shadcn has no equivalent.
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="border-border flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center">
      <p className="text-foreground text-sm font-medium">{title}</p>
      {hint && <p className="text-muted-foreground mt-1 max-w-sm text-sm">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
