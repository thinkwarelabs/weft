// Onboarding is a checklist on the PROJECT, not the client — a studio onboards
// an engagement, and a returning client onboards again for the next one.
//
// Stored in Project.onboarding as JSON rather than its own table: the list is
// short, always read whole, never queried across projects, and changes shape as
// the studio's process changes. A table would buy nothing and cost a migration
// every time a step is added.
//
// Pure module, no I/O — the route handlers do the reading and writing.

export interface ChecklistItem {
  key: string
  label: string
  doneAt: string | null // ISO timestamp
  doneByUserId: string | null
}

interface TemplateItem {
  key: string
  label: string
}

// The studio's standard sequence. Adding an entry here rolls it out to EVERY
// project automatically, including ones already underway — see mergeTemplate.
// Removing an entry hides it without destroying the record of it being done.
export const CHECKLIST_TEMPLATE: readonly TemplateItem[] = [
  { key: 'agreement', label: 'Agreement signed' },
  { key: 'deposit', label: 'Deposit invoiced' },
  { key: 'kickoff', label: 'Kickoff call held' },
  { key: 'brief', label: 'Brief and scope confirmed' },
  { key: 'assets', label: 'Brand assets and content received' },
  // Deliberately worded as "access arranged", not "credentials stored". This
  // platform must never hold a client credential, .env value or API key — a
  // dedicated secrets manager does that. Link to where a secret lives; never
  // paste one into a checklist note.
  { key: 'access', label: 'Access arranged (via the secrets manager, never here)' },
  { key: 'environment', label: 'Staging environment up' },
  { key: 'contacts', label: 'Client contacts added for feedback' },
] as const

export function defaultChecklist(): ChecklistItem[] {
  return CHECKLIST_TEMPLATE.map((t) => ({
    key: t.key,
    label: t.label,
    doneAt: null,
    doneByUserId: null,
  }))
}

function isItem(value: unknown): value is ChecklistItem {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.key === 'string' && v.key.length > 0
}

/**
 * Read whatever is in the JSON column and return a usable checklist.
 *
 * Tolerates null, garbage, and older shapes — a malformed value must never
 * break a project page. Stored completion state wins; labels always come from
 * the template so wording changes propagate. Items the template no longer
 * mentions are dropped, but only if they were never completed: throwing away a
 * record of work someone actually did is worse than showing a stale row.
 */
export function normalizeChecklist(stored: unknown): ChecklistItem[] {
  const existing = new Map<string, ChecklistItem>()
  if (Array.isArray(stored)) {
    for (const raw of stored) {
      if (!isItem(raw)) continue
      const v = raw as unknown as Record<string, unknown>
      existing.set(raw.key, {
        key: raw.key,
        label: typeof v.label === 'string' ? v.label : raw.key,
        doneAt: typeof v.doneAt === 'string' ? v.doneAt : null,
        doneByUserId: typeof v.doneByUserId === 'string' ? v.doneByUserId : null,
      })
    }
  }

  const merged: ChecklistItem[] = CHECKLIST_TEMPLATE.map((t) => {
    const prior = existing.get(t.key)
    return {
      key: t.key,
      label: t.label, // template is the source of truth for wording
      doneAt: prior?.doneAt ?? null,
      doneByUserId: prior?.doneByUserId ?? null,
    }
  })

  const templateKeys = new Set(CHECKLIST_TEMPLATE.map((t) => t.key))
  for (const [key, item] of existing) {
    if (!templateKeys.has(key) && item.doneAt) merged.push(item)
  }

  return merged
}

/** Tick or untick one item. Returns a new array; never mutates the input. */
export function setItemDone(
  items: ChecklistItem[],
  key: string,
  done: boolean,
  userId: string,
  now: Date = new Date(),
): ChecklistItem[] {
  return items.map((item) =>
    item.key === key
      ? {
          ...item,
          doneAt: done ? (item.doneAt ?? now.toISOString()) : null,
          doneByUserId: done ? (item.doneByUserId ?? userId) : null,
        }
      : item,
  )
}

export interface ChecklistProgress {
  done: number
  total: number
  complete: boolean
  percent: number
}

export function checklistProgress(items: ChecklistItem[]): ChecklistProgress {
  const total = items.length
  const done = items.filter((i) => i.doneAt !== null).length
  return {
    done,
    total,
    complete: total > 0 && done === total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  }
}
