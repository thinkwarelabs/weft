import { InvoiceStatus } from '@/lib/types'
import { cn } from '@/lib/cn'

const styles: Record<InvoiceStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  finalized: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const labels: Record<InvoiceStatus, string> = { draft: 'Draft', finalized: 'Finalized', paid: 'Paid' }

export function Badge({ status }: { status: InvoiceStatus }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', styles[status])}>
      {labels[status]}
    </span>
  )
}
