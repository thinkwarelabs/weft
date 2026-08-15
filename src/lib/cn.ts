// Re-exported so both import paths resolve to ONE implementation during the
// shadcn migration.
//
// The previous version here just joined strings, which does not de-duplicate
// conflicting Tailwind classes — passing className="px-2" to a component with
// px-4 baked in produced both, and the winner was whichever CSS rule happened
// to come last. tailwind-merge resolves that properly, and every shadcn
// component assumes it.
//
// Once every import points at @/lib/utils, delete this file.
export { cn } from '@/lib/utils'
