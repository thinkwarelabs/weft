'use client'
import {
  Select as SelectRoot,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface SelectOption {
  value: string
  label: string
}

// Value/options wrapper over shadcn's composed Select.
//
// Named `select-field` rather than `select` so it cannot collide with the
// registry component it wraps — on a case-insensitive filesystem that matters
// more than usual.
//
// Six call sites pass a flat options array. Composing SelectRoot/Trigger/
// Content/Item at each one would be six copies of identical scaffolding, and
// the options genuinely are data here rather than markup.
//
// What this gains over the hand-rolled listbox it replaces: typeahead, correct
// roving focus, Home/End, portal-based positioning that escapes overflow
// containers, and no custom keyboard handling to maintain.
export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  className,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  disabled?: boolean
}) {
  return (
    <SelectRoot
      value={value || undefined}
      // Base UI emits null when a selection is cleared. Every caller models
      // value as a plain string, so an empty string is the honest mapping.
      onValueChange={(v) => onChange(v ?? '')}
      disabled={disabled}
    >
      <SelectTrigger className={className ?? 'w-full'}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  )
}
