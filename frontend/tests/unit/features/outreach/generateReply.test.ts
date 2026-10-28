import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Minimal in-memory stand-in for the Admin SDK ─────────────────────────────
const store = new Map<string, Record<string, unknown>>()
const ts = (ms: number) => ({ toMillis: () => ms })

function docRef(path: string): unknown {
  return {
    id: path.split('/').at(-1),
    get: async () => snap(path),
    create: vi.fn(async (data: Record<string, unknown>) => {
      if (store.has(path)) throw Object.assign(new Error('exists'), { code: 6 })
      store.set(path, data)
    }),
    collection: (name: string) => collectionRef(`${path}/${name}`),
  }
}
function snap(path: string) {
  const data = store.get(path)
  return {
    id: path.split('/').at(-1),
    exists: !!data,
    data: () => data,
    get: (field: string) => data?.[field],
  }
}
function collectionRef(path: string) {
  return {
    doc: (id: string) => docRef(`${path}/${id}`),
    where: (field: string, _op: string, value: unknown) => ({
      get: async () => ({
        docs: [...store.keys()]
          .filter(
            (k) => k.startsWith(`${path}/`) && k.split('/').length === path.split('/').length + 1
          )
          .filter((k) => store.get(k)?.[field] === value)
          .map(snap),
      }),
    }),
  }
}

vi.mock('server-only', () => ({}))
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'NOW' } }))
vi.mock('@/lib/firebase/admin', () => ({
  adminDb: { collection: (n: string) => collectionRef(n) },
}))
vi.mock('@/actions/auth.actions', () => ({ requireAuth: vi.fn(async () => ({ uid: 'alice' })) }))

const generateContactReply = vi.fn()
class ReplyTimeoutError extends Error {}
vi.mock('@/features/outreach/lib/gemini', () => ({ generateContactReply, ReplyTimeoutError }))

const { generateReply } = await import('@/features/outreach/actions/generateReply')

const ENG = 'engagements/alice_s1'
const input = { engagementId: 'alice_s1', outboundId: 'm1' }

beforeEach(() => {
  store.clear()
  generateContactReply.mockReset()
  store.set(ENG, { userId: 'alice', scenarioId: 's1' })
  store.set(`${ENG}/messages/m1`, {
    contactId: 'c1',
    direction: 'outbound',
    subject: 'Intro',
    body: 'Hello',
    createdAt: ts(1000),
  })
  store.set('scenarios/s1', { companyName: 'Acme', brief: 'Brief', title: 'T' })
  store.set('scenarios/s1/contacts/c1', { name: 'Dana', role: 'COO' })
  store.set('scenarios/s1/contactPersonas/c1', { persona: 'Busy.' })
})

describe('generateReply', () => {
  it('saves an inbound reply linked to the email (AC6)', async () => {
    generateContactReply.mockResolvedValue('Thanks — happy to talk. Dana')
    const result = await generateReply(input)

    expect(result).toEqual({ success: true, data: { replyId: 'm1_reply' } })
    expect(store.get(`${ENG}/messages/m1_reply`)).toMatchObject({
      direction: 'inbound',
      replyTo: 'm1',
      contactId: 'c1',
      subject: 'Re: Intro',
      body: 'Thanks — happy to talk. Dana',
    })
    expect(generateContactReply.mock.calls[0]![0]).toMatchObject({
      contactName: 'Dana',
      persona: 'Busy.',
      thread: [{ direction: 'outbound', subject: 'Intro', body: 'Hello' }],
    })
  })

  it("refuses another learner's engagement (AC8)", async () => {
    store.set(ENG, { userId: 'bob', scenarioId: 's1' })
    const result = await generateReply(input)
    expect(result.success).toBe(false)
    expect(generateContactReply).not.toHaveBeenCalled()
  })

  it('is idempotent: an existing reply is returned without calling Gemini (AC7)', async () => {
    store.set(`${ENG}/messages/m1_reply`, { direction: 'inbound' })
    const result = await generateReply(input)
    expect(result).toEqual({ success: true, data: { replyId: 'm1_reply' } })
    expect(generateContactReply).not.toHaveBeenCalled()
  })

  it('reports a timeout without saving anything (AC7)', async () => {
    generateContactReply.mockRejectedValue(new ReplyTimeoutError())
    const result = await generateReply(input)
    expect(result).toEqual({ success: false, error: 'The reply took too long. Try again.' })
    expect(store.has(`${ENG}/messages/m1_reply`)).toBe(false)
  })

  it('rejects malformed IDs before touching Firestore', async () => {
    const result = await generateReply({ engagementId: '../x', outboundId: 'm1' })
    expect(result.success).toBe(false)
  })
})
