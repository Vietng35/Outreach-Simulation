import { describe, expect, it } from 'vitest'
import { emailDraftSchema, generateReplySchema } from '@/features/outreach/validation'

describe('emailDraftSchema (AC5)', () => {
  const valid = { subject: 'Intro', body: 'Hello there' }

  it('accepts a normal email and trims it', () => {
    expect(emailDraftSchema.parse({ subject: '  Intro ', body: ' Hi \n' })).toEqual({
      subject: 'Intro',
      body: 'Hi',
    })
  })

  it.each([
    ['empty subject', { ...valid, subject: '' }],
    ['blank subject', { ...valid, subject: '   ' }],
    ['121-char subject', { ...valid, subject: 'x'.repeat(121) }],
    ['empty body', { ...valid, body: '' }],
    ['2001-char body', { ...valid, body: 'x'.repeat(2001) }],
  ])('rejects %s', (_, draft) => {
    expect(emailDraftSchema.safeParse(draft).success).toBe(false)
  })

  it('accepts the exact limits', () => {
    expect(
      emailDraftSchema.safeParse({ subject: 'x'.repeat(120), body: 'x'.repeat(2000) }).success
    ).toBe(true)
  })
})

describe('generateReplySchema', () => {
  it('rejects IDs that could break a document path', () => {
    expect(generateReplySchema.safeParse({ engagementId: 'a/b', outboundId: 'm1' }).success).toBe(
      false
    )
    expect(generateReplySchema.safeParse({ engagementId: 'u_s1', outboundId: '' }).success).toBe(
      false
    )
    expect(generateReplySchema.safeParse({ engagementId: 'u_s1', outboundId: 'm1' }).success).toBe(
      true
    )
  })
})
