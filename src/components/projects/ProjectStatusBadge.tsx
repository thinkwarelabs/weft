import { cn } from '@/lib/cn'
import type { ProjectStatus } from '@/lib/types'

// Separate from ui/Badge, which is typed to InvoiceStatus. Project status is a
// different vocabulary and shouldn't be squeezed into the invoice one.
const styles: Record<ProjectStatus, string> = {
  onboarding: 'bg-amber-50 text-amber-700 border-amber-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  paused: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  closed: 'bg-zinc-100 text-zinc-500 border-zinc-200',
}

const labels: Record<ProjectStatus, string> = {
  onboarding: 'Onboarding',
  active: 'Active',
  paused: 'Paused',
  closed: 'Closed',
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        styles[status]
      )}
    >
      {labels[status]}
    </span>
  )
}
