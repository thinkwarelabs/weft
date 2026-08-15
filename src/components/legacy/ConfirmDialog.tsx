'use client'
import { useState } from 'react'
import { Modal } from './Modal'
import { Button } from '@/components/ui/button'

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false }: {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}) {
  const [busy, setBusy] = useState(false)
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            variant={danger ? 'destructive' : 'default'}
            loading={busy}
            onClick={async () => {
              setBusy(true)
              try { await onConfirm() } finally { setBusy(false); onClose() }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-zinc-600">{message}</p>
    </Modal>
  )
}
