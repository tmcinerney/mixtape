import { z } from 'zod'

export const MetadataResponseSchema = z.object({
  type: z.enum(['video', 'playlist']),
  title: z.string(),
  suggestedTitle: z.string(),
  coverOptions: z.array(z.string().url()),
  totalDuration: z.number(),
  truncatedAt: z.number().optional(),
  tracks: z.array(
    z.object({
      videoId: z.string(),
      title: z.string(),
      suggestedTitle: z.string(),
      duration: z.number(),
    }),
  ),
})

export type MetadataResponse = z.infer<typeof MetadataResponseSchema>

export const ImportJobRequestSchema = z
  .object({
    url: z.string().url(),
    cardId: z.string().optional(),
    cardTitle: z.string().max(100).optional(),
    coverUrl: z.string().url().optional(),
    tracks: z.array(
      z.object({
        videoId: z.string(),
        title: z.string(),
      }),
    ),
    yotoToken: z.string(),
  })
  .refine((d) => d.cardId || d.cardTitle, {
    message: 'Either cardId or cardTitle is required',
  })

export type ImportJobRequest = z.infer<typeof ImportJobRequestSchema>

export const ImportProgressSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('card-created'), cardId: z.string() }),
  z.object({
    type: z.literal('track-start'),
    index: z.number(),
    total: z.number(),
    title: z.string(),
  }),
  z.object({
    type: z.literal('track-progress'),
    step: z.enum(['download', 'upload', 'transcode']),
    progress: z.number(),
  }),
  z.object({ type: z.literal('track-complete'), index: z.number() }),
  z.object({
    type: z.literal('track-skipped'),
    index: z.number(),
    title: z.string(),
    reason: z.string(),
  }),
  z.object({
    type: z.literal('complete'),
    cardId: z.string(),
    imported: z.number(),
    skipped: z.array(z.object({ title: z.string(), reason: z.string() })),
  }),
  z.object({ type: z.literal('cancelled'), cardId: z.string(), imported: z.number() }),
  z.object({ type: z.literal('error'), message: z.string() }),
])

export type ImportProgress = z.infer<typeof ImportProgressSchema>
