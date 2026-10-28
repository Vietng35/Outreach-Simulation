import { beforeEach, describe, expect, it, vi } from 'vitest'

const commit = vi.fn()
const set = vi.fn()
const update = vi.fn()

vi.mock('@/lib/firebase/client', () => ({ getClientDb: () => ({}) }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn((_parent: unknown, id?: string) => ({ id: id ?? 'generated-id' })),
  FieldPath: vi.fn(function (this: { parts: string[] }, ...parts: string[]) {
    this.parts = parts
  }),
  increment: vi.fn((n: number) => ({ increment: n })),
  serverTimestamp: vi.fn(() => 'SERVER_TIME'),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  writeBatch: vi.fn(() => ({ set, update, commit })),
}))

const { sendOutreachEmail } = await import('@/features/outreach/lib/sendEmail')

const base = { engagementId: 'u1_s1', contactId: 'c1', messageId: 'm1' }

describe('sendOutreachEmail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('writes the email and the counter bump in one batch (AC2)', async () => {
    commit.mockResolvedValue(undefined)
    const result = await sendOutreachEmail({ ...base, draft: { subject: ' Hi ', body: 'Hello' } })

    expect(result).toEqual({ success: true, messageId: 'm1' })
    expect(set).toHaveBeenCalledWith(
      { id: 'm1' },
      expect.objectContaining({ contactId: 'c1', direction: 'outbound', subject: 'Hi' })
    )
    const [, fieldPath, bump, field, value] = update.mock.calls[0]!
    expect((fieldPath as { parts: string[] }).parts).toEqual(['emailCounts', 'c1'])
    expect(bump).toEqual({ increment: 1 })
    expect([field, value]).toEqual(['lastMessageId', 'm1'])
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('does not write anything for an invalid draft', async () => {
    const result = await sendOutreachEmail({ ...base, draft: { subject: '', body: 'x' } })
    expect(result).toMatchObject({ success: false, reason: 'invalid' })
    expect(commit).not.toHaveBeenCalled()
  })

  it('reports the limit when the rules reject the batch (AC3)', async () => {
    commit.mockRejectedValue({ code: 'permission-denied' })
    const result = await sendOutreachEmail({ ...base, draft: { subject: 'Hi', body: 'x' } })
    expect(result).toMatchObject({ success: false, reason: 'limit' })
  })

  it('reports other failures without blaming the limit', async () => {
    commit.mockRejectedValue({ code: 'unavailable' })
    const result = await sendOutreachEmail({ ...base, draft: { subject: 'Hi', body: 'x' } })
    expect(result).toMatchObject({ success: false, reason: 'failed' })
  })
})
