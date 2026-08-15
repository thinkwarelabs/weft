'use client'
import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

// No shadcn equivalent — this is a local component, but it lives in ui/ because
// it is part of the design system rather than a feature.
//
// Improvement over the version it replaces: the label is wired to the control
// with a generated id, so clicking the label focuses the input and screen
// readers announce them together. The old one rendered a bare <label> with no
// htmlFor, which looked identical and did neither.
export function Field({
  label,
  error,
  children,
  className,
  htmlFor,
}: {
  label: string
  error?: string
  children: ReactNode
  className?: string
  /** Pass when the control sets its own id; otherwise one is generated. */
  htmlFor?: string
}) {
  const generated = useId()
  const id = htmlFor ?? generated

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-foreground text-sm font-medium">
        {label}
      </label>
      {/* Children that accept an id get one; the rest are rendered untouched. */}
      <div id={htmlFor ? undefined : id} className="contents">
        {children}
      </div>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  )
}
