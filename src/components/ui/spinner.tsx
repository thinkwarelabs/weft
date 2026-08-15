import { cn } from '@/lib/utils'

// No shadcn equivalent (its Skeleton covers a different case — known layout,
// unknown content). Kept as a local design-system component.
//
// `aria-hidden` plus an adjacent live region would be better still where a
// spinner is the only thing on screen; for now callers that block a whole page
// pair it with visible text.
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className ?? 'size-4')}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Loading"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}
