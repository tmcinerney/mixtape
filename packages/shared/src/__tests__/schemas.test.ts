import { describe, expect, it } from 'vitest'
import { JobStatusSchema } from '../schemas'

describe('JobStatusSchema', () => {
  it.each(['queued', 'running', 'complete', 'failed', 'cancelled'] as const)(
    'accepts "%s"',
    (status) => {
      const result = JobStatusSchema.safeParse(status)
      expect(result.success).toBe(true)
    },
  )

  it('rejects an invalid status', () => {
    const result = JobStatusSchema.safeParse('pending')
    expect(result.success).toBe(false)
  })
})
