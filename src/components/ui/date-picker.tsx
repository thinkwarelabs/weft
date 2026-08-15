'use client'
// Moved from the pre-shadcn kit. No registry equivalent exists, so it stays
// local — but it now lives in ui/ and uses the shared cn/tokens.
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { todayISO } from '@/lib/dates'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toISO(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

function parseISO(iso: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  return { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) }
}

interface Cell {
  iso: string
  day: number
  inMonth: boolean
}

function buildGrid(year: number, month: number): Cell[] {
  const firstWeekday = new Date(year, month, 1).getDay()
  const cells: Cell[] = []
  const start = new Date(year, month, 1 - firstWeekday)
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    cells.push({
      iso: toISO(d.getFullYear(), d.getMonth(), d.getDate()),
      day: d.getDate(),
      inMonth: d.getMonth() === month,
    })
  }
  return cells
}

export function DatePicker({ value, onChange, className, disabled }: {
  value: string
  onChange: (iso: string) => void
  className?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const parsed = parseISO(value)
  const today = parseISO(todayISO())!
  const [view, setView] = useState({ year: (parsed ?? today).year, month: (parsed ?? today).month })
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function openCalendar() {
    const p = parseISO(value) ?? today
    setView({ year: p.year, month: p.month })
    setOpen(true)
  }

  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  function pick(iso: string) {
    onChange(iso)
    setOpen(false)
  }

  const label = parsed
    ? `${pad(parsed.day)} ${MONTHS[parsed.month].slice(0, 3)} ${parsed.year}`
    : 'Pick a date'
  const grid = buildGrid(view.year, view.month)
  const todayIso = toISO(today.year, today.month, today.day)

  return (
    <div ref={rootRef} className={cn('relative w-full', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openCalendar())}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          'flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-left text-sm transition-colors focus:border-zinc-900 focus:outline-none disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400',
          open && 'border-zinc-900'
        )}
      >
        <span className={cn(!parsed && 'text-zinc-400')}>{label}</span>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden className="shrink-0 text-zinc-500">
          <rect x="2" y="3" width="12" height="11" rx="1.5" />
          <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
        </svg>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Choose date"
          className="dropdown-panel absolute z-30 mt-1.5 w-72 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="px-1 text-sm font-medium">
              {MONTHS[view.month]} {view.year}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
                className="cursor-pointer rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
                className="cursor-pointer rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((d) => (
              <span key={d} className="pb-1.5 text-xs font-medium text-zinc-400">{d}</span>
            ))}
            {grid.map((cell) => {
              const isSelected = cell.iso === value
              const isToday = cell.iso === todayIso
              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => pick(cell.iso)}
                  aria-label={cell.iso}
                  aria-pressed={isSelected}
                  aria-current={isToday ? 'date' : undefined}
                  className={cn(
                    'mx-auto flex size-8 cursor-pointer items-center justify-center rounded-lg text-sm transition-colors',
                    isSelected
                      ? 'bg-zinc-900 font-semibold text-white hover:bg-zinc-700'
                      : cell.inMonth
                        ? 'text-zinc-700 hover:bg-zinc-100'
                        : 'text-zinc-300 hover:bg-zinc-50',
                    isToday && !isSelected && 'font-semibold text-zinc-900 ring-1 ring-inset ring-zinc-300'
                  )}
                >
                  {cell.day}
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-zinc-100 pt-2">
            <button
              type="button"
              onClick={() => pick('')}
              className="cursor-pointer rounded-md px-2 py-1 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => pick(todayIso)}
              className="cursor-pointer rounded-md px-2 py-1 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
