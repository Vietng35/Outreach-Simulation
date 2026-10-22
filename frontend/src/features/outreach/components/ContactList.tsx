import { AlertCircle, Users } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils'
import { RemainingBadge } from './RemainingBadge'

export interface ContactSummary {
  id: string
  name: string
  role: string
  bio: string
  remaining: number
}

interface ContactListProps {
  contacts: ContactSummary[]
  loading: boolean
  error: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  onRetry: () => void
}

/** Screen A — the scenario's contacts, each with how many emails are left. */
export function ContactList({
  contacts,
  loading,
  error,
  selectedId,
  onSelect,
  onRetry,
}: ContactListProps) {
  if (loading) {
    return (
      <ul aria-label="Loading contacts" className="space-y-2">
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className="h-20 animate-pulse rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800"
          />
        ))}
      </ul>
    )
  }

  if (error) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Couldn’t load contacts"
        description="Check your connection and try again."
        action={
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Retry
          </button>
        }
      />
    )
  }

  if (contacts.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No contacts in this scenario yet"
        description="Ask your facilitator to add the client’s contacts."
      />
    )
  }

  return (
    <ul className="space-y-2">
      {contacts.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => onSelect(c.id)}
            aria-pressed={selectedId === c.id}
            className={cn(
              'w-full rounded-lg border bg-white p-4 text-left transition-colors hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800',
              selectedId === c.id
                ? 'border-zinc-900 dark:border-zinc-300'
                : 'border-zinc-200 dark:border-zinc-800'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{c.name}</p>
                <p className="truncate text-xs text-zinc-500">{c.role}</p>
              </div>
              <RemainingBadge remaining={c.remaining} />
            </div>
            <p className="mt-2 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">{c.bio}</p>
          </button>
        </li>
      ))}
    </ul>
  )
}
