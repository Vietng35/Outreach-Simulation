import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ThreadView, type ThreadItem } from '@/features/outreach/components/ThreadView'

const outbound = (id: string): ThreadItem['message'] => ({
  id,
  contactId: 'c1',
  direction: 'outbound',
  subject: 'Intro',
  body: 'Hello',
  createdAt: null,
  _schemaVersion: 1,
})

describe('ThreadView', () => {
  it('invites a first email when the thread is empty', () => {
    render(<ThreadView contactName="Dana" items={[]} onRetryReply={vi.fn()} />)
    expect(screen.getByText(/Introduce yourself to Dana/)).toBeInTheDocument()
  })

  it('shows a typing indicator while the reply is generated', () => {
    render(
      <ThreadView
        contactName="Dana"
        items={[{ message: outbound('m1'), replyStatus: 'awaiting' }]}
        onRetryReply={vi.fn()}
      />
    )
    expect(screen.getByRole('status')).toHaveTextContent('Dana is typing')
  })

  it('offers Retry reply when generation failed (AC7)', async () => {
    const onRetryReply = vi.fn()
    render(
      <ThreadView
        contactName="Dana"
        items={[{ message: outbound('m1'), replyStatus: 'failed', replyError: 'Too slow.' }]}
        onRetryReply={onRetryReply}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Too slow.')
    await userEvent.click(screen.getByRole('button', { name: 'Retry reply' }))
    expect(onRetryReply).toHaveBeenCalledWith('m1')
  })
})
