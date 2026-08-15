'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'

// Confirmation prompt. Built on Modal rather than shadcn's AlertDialog so there
// is one dialog implementation in the app instead of two that drift apart.
//
// The confirm handler may be async; the button stays disabled with a spinner
// until it settles, so a slow archive can't be fired twice by an impatient
// second click.
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
}: {
  open: boolean
  onClose: () => void
  // Deliberately `unknown` rather than void: handlers often end with a
  // toast() call, and sonner returns the toast id. Requiring void would
  // force a pointless wrapper at every call site.
  onConfirm: () => unknown | Promise<unknown>
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}) {
  const [working, setWorking] = useState(false)

  async function confirm() {
    setWorking(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setWorking(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={working}>
            Cancel
          </Button>
          <Button
            variant={danger ? 'destructive' : 'default'}
            loading={working}
            onClick={confirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-muted-foreground text-sm">{message}</p>
    </Modal>
  )
}
