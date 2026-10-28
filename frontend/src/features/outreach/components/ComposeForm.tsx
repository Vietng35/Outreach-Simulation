'use client'

import { useState, type FormEvent } from 'react'
import { AlertCircle, Send } from 'lucide-react'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { cn } from '@/lib/utils'
import { BODY_MAX, SUBJECT_MAX } from '../constants'
import { emailDraftSchema, type EmailDraft } from '../validation'
import { RemainingBadge } from './RemainingBadge'

interface ComposeFormProps {
  contactName: string
  remaining: number
  /** Resolves with an error message, or null when the email was sent. */
  onSend: (draft: EmailDraft) => Promise<string | null>
}

type FieldErrors = Partial<Record<keyof EmailDraft, string>>

const inputClass =
  'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900'

/** Screen B (bottom) — write and send one email, with the remaining count beside Send. */
export function ComposeForm({ contactName, remaining, onSend }: ComposeFormProps) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [sendError, setSendError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  if (remaining <= 0) {
    return (
      <div
        role="status"
        className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
      >
        You’ve used all your emails to {contactName}. Choose another contact to keep going.
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSendError(null)
    const parsed = emailDraftSchema.safeParse({ subject, body })
    if (!parsed.success) {
      const errors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof EmailDraft
        errors[field] ??= issue.message
      }
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    setSending(true)
    const error = await onSend(parsed.data)
    setSending(false)
    if (error) {
      setSendError(error) // draft is kept so nothing the learner wrote is lost
    } else {
      setSubject('')
      setBody('')
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3">
      {sendError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {sendError}
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor="outreach-subject" className="text-sm font-medium">
          Subject
        </label>
        <input
          id="outreach-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={SUBJECT_MAX + 20}
          disabled={sending}
          aria-invalid={!!fieldErrors.subject}
          aria-describedby={fieldErrors.subject ? 'outreach-subject-error' : undefined}
          className={cn(inputClass, fieldErrors.subject && 'border-red-500')}
          placeholder={`Introduce yourself to ${contactName}`}
        />
        {fieldErrors.subject && (
          <p id="outreach-subject-error" className="text-xs text-red-600">
            {fieldErrors.subject}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="outreach-body" className="text-sm font-medium">
          Message
        </label>
        <textarea
          id="outreach-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          disabled={sending}
          aria-invalid={!!fieldErrors.body}
          aria-describedby={fieldErrors.body ? 'outreach-body-error' : 'outreach-body-count'}
          className={cn(inputClass, 'resize-y', fieldErrors.body && 'border-red-500')}
        />
        <div className="flex justify-between text-xs">
          <span id="outreach-body-error" className="text-red-600">
            {fieldErrors.body}
          </span>
          <span id="outreach-body-count" className="text-zinc-500">
            {body.length}/{BODY_MAX}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <RemainingBadge remaining={remaining} />
        <button
          type="submit"
          disabled={sending}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {sending ? (
            <LoadingSpinner size="sm" className="border-zinc-500 border-t-white" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </form>
  )
}
