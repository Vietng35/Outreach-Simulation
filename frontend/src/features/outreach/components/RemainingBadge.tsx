import { cn } from '@/lib/utils'
import { EMAIL_LIMIT_PER_CONTACT } from '../constants'

export function RemainingBadge({ remaining }: { remaining: number }) {
  const atLimit = remaining <= 0
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium',
        atLimit
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
          : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
      )}
    >
      {atLimit ? 'Limit reached' : `${remaining} of ${EMAIL_LIMIT_PER_CONTACT} left`}
    </span>
  )
}
