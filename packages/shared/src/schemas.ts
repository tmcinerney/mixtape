import { z } from 'zod'

export const JobRequestSchema = z.object({
  youtubeUrl: z
    .string()
    .url()
    .regex(/youtube\.com|youtu\.be/),
  cardId: z.string(),
  yotoToken: z.string(),
})

export type JobRequest = z.infer<typeof JobRequestSchema>

export const JobProgressSchema = z.discriminatedUnion('step', [
  z.object({ step: z.literal('download'), progress: z.number().min(0).max(100) }),
  z.object({ step: z.literal('convert'), progress: z.number().min(0).max(100) }),
  z.object({ step: z.literal('upload'), progress: z.number().min(0).max(100) }),
  z.object({ step: z.literal('transcode'), progress: z.number().min(0).max(100) }),
  z.object({ step: z.literal('complete'), mediaUrl: z.string() }),
  z.object({ step: z.literal('error'), message: z.string(), code: z.string() }),
])

export type JobProgress = z.infer<typeof JobProgressSchema>

export const JobStatusSchema = z.enum(['queued', 'running', 'complete', 'failed', 'cancelled'])

export type JobStatus = z.infer<typeof JobStatusSchema>
