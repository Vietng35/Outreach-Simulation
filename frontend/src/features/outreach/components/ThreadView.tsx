import { AlertCircle, Mail } from 'lucide-react'
import { cn, formatDatetime } from '@/lib/utils'
import type { MessageWithId } from '../hooks/useMessages'

export type ReplyStatus = 'replied' | 'awaiting' | 'failed'

export interface ThreadItem {
  message: MessageWithId
  /** Outbound only. */
  replyStatus?: ReplyStatus
  replyError?: string
}

interface ThreadViewProps {
  contactName: string
  items: ThreadItem[]
  onRetryReply: (outboundId: string) => void
}

/** Screen B (top) — the conversation with one contact. */
export function ThreadView({ contactName, items, onRetryReply }: ThreadViewProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <Mail className="h-6 w-6 text-zinc-400" />
        <p className="text-sm font-medium">No emails yet</p>
        <p className="text-sm text-zinc-500">Introduce yourself to {contactName} below.</p>
      </div>
    )
  }

  return (
    <ol className="space-y-4" aria-label={`Emails with ${contactName}`}>
      {items.map(({ message, replyStatus, replyError }) => {
        const outbound = message.direction === 'outbound'
        return (
          <li
            key={message.id}
            className={cn('flex flex-col', outbound ? 'items-end' : 'items-start')}
          >
            <article
              className={cn(
                'max-w-[85%] rounded-lg border p-3 text-sm',
                outbound
                  ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                  : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
              )}
            >
              <header className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 text-xs opacity-75">
                <span className="font-medium">{outbound ? 'You' : contactName}</span>
                <time>
                  {message.createdAt ? formatDatetime(message.createdAt.toDate()) : 'Sending…'}
                </time>
              </header>
              <p className="font-medium">{message.subject}</p>
              <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
            </article>

            {outbound && replyStatus === 'awaiting' && (
              <p role="status" className="mt-2 self-start text-xs text-zinc-500">
                <span className="animate-pulse">{contactName} is typing…</span>
              </p>
            )}
            {outbound && replyStatus === 'failed' && (
              <div
                role="alert"
                className="mt-2 flex items-center gap-2 self-start rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{replyError ?? 'Reply couldn’t be generated.'}</span>
                <button
                  type="button"
                  onClick={() => onRetryReply(message.id)}
                  className="font-medium underline underline-offset-2"
                >
                  Retry reply
                </button>
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
