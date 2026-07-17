'use client'
import { KeyboardEvent, useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

export interface SelectOption {
  value: string
  label: string
}

export function Select({ value, onChange, options, placeholder = 'Select…', className, disabled }: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listboxId = useId()

  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    listRef.current?.children[highlighted]?.scrollIntoView({ block: 'nearest' })
  }, [open, highlighted])

  function openList() {
    const idx = options.findIndex((o) => o.value === value)
    setHighlighted(idx >= 0 ? idx : 0)
    setOpen(true)
  }

  function pick(option: SelectOption) {
    onChange(option.value)
    setOpen(false)
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (!open) openList()
        else setHighlighted((h) => Math.min(h + 1, options.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        if (!open) openList()
        else setHighlighted((h) => Math.max(h - 1, 0))
        break
      case 'Home':
        if (open) { e.preventDefault(); setHighlighted(0) }
        break
      case 'End':
        if (open) { e.preventDefault(); setHighlighted(options.length - 1) }
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (!open) openList()
        else if (options[highlighted]) pick(options[highlighted])
        break
      case 'Escape':
        if (open) { e.preventDefault(); setOpen(false) }
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }

  return (
    <div ref={rootRef} className={cn('relative w-full', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        className={cn(
          'flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-left text-sm transition-colors focus:border-zinc-900 focus:outline-none disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400',
          open && 'border-zinc-900'
        )}
      >
        <span className={cn('truncate', !selected && 'text-zinc-400')}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden
          className={cn('shrink-0 text-zinc-500 transition-transform duration-150', open && 'rotate-180')}
        >
          <path d="M4.646 6.146a.5.5 0 0 1 .708 0L8 8.793l2.646-2.647a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z" />
        </svg>
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="dropdown-panel absolute z-30 mt-1.5 max-h-60 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-lg"
        >
          {options.length === 0 && (
            <li className="px-2.5 py-2 text-sm text-zinc-400">No options</li>
          )}
          {options.map((option, i) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              onMouseEnter={() => setHighlighted(i)}
              onClick={() => pick(option)}
              className={cn(
                'flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm text-zinc-700 transition-colors',
                i === highlighted && 'bg-zinc-100 text-zinc-900'
              )}
            >
              <span className="truncate">{option.label}</span>
              {option.value === value && (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden className="shrink-0 text-zinc-900">
                  <path d="M3 8.5l3.2 3.2L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
