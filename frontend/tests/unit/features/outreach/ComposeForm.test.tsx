import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ComposeForm } from '@/features/outreach/components/ComposeForm'

function setup(remaining = 3, onSend = vi.fn().mockResolvedValue(null)) {
  render(<ComposeForm contactName="Dana" remaining={remaining} onSend={onSend} />)
  return { onSend, user: userEvent.setup() }
}

describe('ComposeForm', () => {
  it('shows the remaining count next to Send (AC1)', () => {
    setup(2)
    expect(screen.getByText('2 of 3 left')).toBeInTheDocument()
  })

  it('shows inline errors and does not send an empty email (AC5)', async () => {
    const { onSend, user } = setup()
    await user.click(screen.getByRole('button', { name: /send/i }))
    expect(screen.getByText('Add a subject')).toBeInTheDocument()
    expect(screen.getByText('Write a message')).toBeInTheDocument()
    expect(onSend).not.toHaveBeenCalled()
  })

  it('sends a trimmed draft and clears the form', async () => {
    const { onSend, user } = setup()
    await user.type(screen.getByLabelText('Subject'), '  Intro ')
    await user.type(screen.getByLabelText('Message'), 'Hello Dana')
    await user.click(screen.getByRole('button', { name: /send/i }))
    expect(onSend).toHaveBeenCalledWith({ subject: 'Intro', body: 'Hello Dana' })
    expect(screen.getByLabelText('Subject')).toHaveValue('')
  })

  it('keeps the draft and shows the error when sending fails', async () => {
    const { user } = setup(3, vi.fn().mockResolvedValue('Couldn’t send your email.'))
    await user.type(screen.getByLabelText('Subject'), 'Intro')
    await user.type(screen.getByLabelText('Message'), 'Hello')
    await user.click(screen.getByRole('button', { name: /send/i }))
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t send your email.')
    expect(screen.getByLabelText('Subject')).toHaveValue('Intro')
  })

  it('replaces the form with a limit message at 0 left (AC4)', () => {
    setup(0)
    expect(screen.queryByRole('button', { name: /send/i })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/used all your emails to Dana/)
  })
})
