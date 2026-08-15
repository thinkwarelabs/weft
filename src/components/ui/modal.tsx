'use client'
import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// A thin, deliberate wrapper over shadcn's Dialog.
//
// The seven call sites all use the same shape — open/close, a title, a body,
// and a footer of buttons — so composing Dialog by hand at each one would
// repeat the same five elements seven times with nothing gained.
//
// What it buys over the hand-rolled modal it replaces: focus trapping, focus
// restore on close, correct aria wiring, scroll locking, and Escape handling
// that does not fight with nested popovers. That was the reason for the whole
// migration, not the visuals.
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto">{children}</div>

        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}
