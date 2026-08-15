'use client'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/legacy/Select'
import { useToast } from '@/components/legacy/Toast'
import { formatDateLong } from '@/lib/dates'
import type { Project } from '@/lib/types'
import { ProjectStatusBadge } from './ProjectStatusBadge'
import { Timeline } from './Timeline'
import { RequestFeedback } from './RequestFeedback'

const STATUS_OPTIONS = [
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'closed', label: 'Closed' },
]

export function ProjectDetail({
  initialProject,
  clientName,
  clientId,
  actorName,
}: {
  initialProject: Project
  clientName: string
  clientId: string
  /** Used to decide which entries show a Remove action; the server re-checks. */
  actorName: string
}) {
  const [project, setProject] = useState<Project>(initialProject)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  // Shared so a feedback request sent above shows up in the timeline below.
  const [timelineSignal, setTimelineSignal] = useState(0)
  const { toast } = useToast()

  const progress = project.onboarding_progress

  async function toggle(key: string, done: boolean) {
    setBusyKey(key)
    const res = await fetch(`/api/projects/${project.id}/checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, done }),
    })
    setBusyKey(null)
    if (res.ok) {
      // The server returns the whole normalised project, so the response is the
      // source of truth rather than a locally patched copy.
      const d = await res.json()
      setProject(d.project)
    } else {
      toast('Failed to update the checklist', 'error')
    }
  }

  async function changeStatus(status: string) {
    const res = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const d = await res.json()
      setProject(d.project)
      toast('Status updated')
    } else {
      toast('Failed to update status', 'error')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-zinc-500">
            {clientName}
            <span aria-hidden>·</span>
            <ProjectStatusBadge status={project.status} />
          </p>
        </div>
        <div className="w-48">
          <Select
            value={project.status}
            onChange={changeStatus}
            options={STATUS_OPTIONS}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Onboarding</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
              <div
                className={`h-full rounded-full transition-all ${
                  progress.complete ? 'bg-emerald-500' : 'bg-zinc-900'
                }`}
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <span className="whitespace-nowrap text-sm text-zinc-500">
              {progress.done} of {progress.total}
            </span>
          </div>

          <ul className="flex flex-col divide-y divide-zinc-100">
            {project.onboarding.map((item) => {
              const done = item.doneAt !== null
              return (
                <li key={item.key} className="flex items-center gap-3 py-2.5">
                  <input
                    type="checkbox"
                    id={`chk-${item.key}`}
                    checked={done}
                    disabled={busyKey === item.key}
                    onChange={(e) => toggle(item.key, e.target.checked)}
                    className="size-4 shrink-0 cursor-pointer rounded border-zinc-300 accent-zinc-900"
                  />
                  <label
                    htmlFor={`chk-${item.key}`}
                    className={`flex-1 cursor-pointer text-sm ${
                      done ? 'text-zinc-400 line-through' : 'text-zinc-800'
                    }`}
                  >
                    {item.label}
                  </label>
                  {done && item.doneAt && (
                    <span className="whitespace-nowrap text-xs text-zinc-400">
                      {formatDateLong(item.doneAt.slice(0, 10))}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>

          <p className="mt-4 border-t border-zinc-100 pt-4 text-xs text-zinc-500">
            Never paste a client credential, <code className="rounded bg-zinc-100 px-1">.env</code>{' '}
            value or API key into this platform. Link to where the secret lives instead.
          </p>
        </CardContent>
      </Card>

      <RequestFeedback
        projectId={project.id}
        clientId={clientId}
        onChanged={() => setTimelineSignal((n) => n + 1)}
      />

      <Timeline projectId={project.id} actorName={actorName} reloadSignal={timelineSignal} />
    </div>
  )
}
