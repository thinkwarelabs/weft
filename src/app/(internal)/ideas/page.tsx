import { IdeasBoard } from '@/components/ideas/IdeasBoard'

export default function IdeasPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Ideas</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Team space. Post it, then refine it in the comments — an idea can&apos;t be edited once
        it&apos;s up.
      </p>
      <div className="mt-8">
        <IdeasBoard />
      </div>
    </>
  )
}
