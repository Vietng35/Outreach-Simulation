import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ContactList } from '@/features/outreach/components/ContactList'

const contacts = [
  { id: 'c1', name: 'Dana Lee', role: 'COO', bio: 'Runs operations', remaining: 3 },
  { id: 'c2', name: 'Sam Ortiz', role: 'IT Manager', bio: 'Owns systems', remaining: 0 },
]
const props = { selectedId: null, onSelect: vi.fn(), onRetry: vi.fn() }

describe('ContactList', () => {
  it('shows a skeleton while loading', () => {
    render(<ContactList {...props} contacts={[]} loading error={false} />)
    expect(screen.getByLabelText('Loading contacts')).toBeInTheDocument()
  })

  it('shows an empty state when the scenario has no contacts', () => {
    render(<ContactList {...props} contacts={[]} loading={false} error={false} />)
    expect(screen.getByText('No contacts in this scenario yet')).toBeInTheDocument()
  })

  it('offers Retry when loading fails', async () => {
    const onRetry = vi.fn()
    render(<ContactList {...props} onRetry={onRetry} contacts={[]} loading={false} error />)
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('lists contacts with their remaining emails (AC1) and selects one', async () => {
    const onSelect = vi.fn()
    render(
      <ContactList
        {...props}
        onSelect={onSelect}
        contacts={contacts}
        loading={false}
        error={false}
      />
    )
    expect(screen.getByText('3 of 3 left')).toBeInTheDocument()
    expect(screen.getByText('Limit reached')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Dana Lee/ }))
    expect(onSelect).toHaveBeenCalledWith('c1')
  })
})
