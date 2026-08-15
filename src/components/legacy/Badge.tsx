import { InvoiceStatus } from '@/lib/types'
import { cn } from '@/lib/cn'

type BadgeStatus = InvoiceStatus | 'overdue'

const styles: Record<BadgeStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  finalized: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-zinc-100 text-zinc-500 border-zinc-200',
  overdue: 'bg-red-50 text-red-700 border-red-200',
}

const labels: Record<BadgeStatus, string> = {
  draft: 'Draft',
  finalized: 'Finalized',
  paid: 'Paid',
  cancelled: 'Cancelled',
  overdue: 'Overdue',
}

export function Badge({ status, label }: { status: BadgeStatus; label?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', styles[status])}>
      {label ?? labels[status]}
    </span>
  )
}
