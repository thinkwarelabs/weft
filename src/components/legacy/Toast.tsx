'use client'
import { ReactNode, createContext, useCallback, useContext, useState } from 'react'
import { cn } from '@/lib/cn'

type ToastType = 'success' | 'error'
interface ToastItem { id: number; msg: string; type: ToastType }

const ToastContext = createContext<{ toast: (msg: string, type?: ToastType) => void }>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const toast = useCallback((msg: string, type: ToastType = 'success') => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev, { id, msg, type }])
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg',
              t.type === 'success' ? 'border-zinc-200 bg-zinc-900 text-white' : 'border-red-200 bg-red-50 text-red-700'
            )}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
