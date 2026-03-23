import { z } from 'zod'

export const JobStatusSchema = z.enum(['queued', 'running', 'complete', 'failed', 'cancelled'])

export type JobStatus = z.infer<typeof JobStatusSchema>
