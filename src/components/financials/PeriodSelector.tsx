'use client'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/cn'
import { Granularity, PeriodSel, periodLabel, periodRange, shiftPeriod } from '@/lib/financials'

const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: 'month', label: 'Monthly' },
  { key: 'quarter', label: 'Quarterly' },
  { key: 'half', label: 'Half-yearly' },
  { key: 'custom', label: 'Custom' },
]

export function PeriodSelector({ sel, onChange }: { sel: PeriodSel; onChange: (s: PeriodSel) => void }) {
  function setGranularity(g: Granularity) {
    if (g === sel.granularity) return
    if (g === 'custom') {
      const { from, to } = periodRange(sel)
      onChange({ granularity: 'custom', year: sel.year, index: 0, from, to })
    } else {
      // Land on the period that contains today, not January/Q1/H1.
      const now = new Date()
      const m = now.getMonth()
      const index = g === 'month' ? m : g === 'quarter' ? Math.floor(m / 3) : Math.floor(m / 6)
      onChange({ granularity: g, year: now.getFullYear(), index })
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-1">
        {GRANULARITIES.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => setGranularity(g.key)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
              sel.granularity === g.key ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
            )}
          >
            {g.label}
          </button>
        ))}
      </div>

      {sel.granularity === 'custom' ? (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={sel.from ?? ''}
            onChange={(e) => onChange({ ...sel, from: e.target.value })}
            className="w-auto"
          />
          <span className="text-sm text-zinc-400">to</span>
          <Input
            type="date"
            value={sel.to ?? ''}
            onChange={(e) => onChange({ ...sel, to: e.target.value })}
            className="w-auto"
          />
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChange(shiftPeriod(sel, -1))}
            aria-label="Previous period"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100"
          >
            ‹
          </button>
          <span className="min-w-[9ch] text-center text-sm font-medium text-zinc-900">{periodLabel(sel)}</span>
          <button
            type="button"
            onClick={() => onChange(shiftPeriod(sel, 1))}
            aria-label="Next period"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100"
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}
