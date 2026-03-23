import { describe, expect, it, vi, beforeEach } from 'vitest'
import { JobQueue, type JobEntry } from '../job-queue'

describe('JobQueue', () => {
  let queue: JobQueue

  beforeEach(() => {
    queue = new JobQueue({ maxConcurrent: 2, cleanupDelayMs: 100 })
  })

  it('enqueues a job and returns a job ID', () => {
    const id = queue.enqueue({
      url: 'https://www.youtube.com/watch?v=abc',
      cardId: 'card-1',
      tracks: [{ videoId: 'abc', title: 'Test' }],
      yotoToken: 'tok',
    })
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('starts jobs up to maxConcurrent immediately', () => {
    const id1 = queue.enqueue({
      url: 'https://www.youtube.com/watch?v=1',
      cardId: 'c1',
      tracks: [{ videoId: '1', title: 'T' }],
      yotoToken: 't',
    })
    const id2 = queue.enqueue({
      url: 'https://www.youtube.com/watch?v=2',
      cardId: 'c2',
      tracks: [{ videoId: '2', title: 'T' }],
      yotoToken: 't',
    })

    expect(queue.getStatus(id1)).toBe('running')
    expect(queue.getStatus(id2)).toBe('running')
  })

  it('queues jobs beyond maxConcurrent', () => {
    queue.enqueue({
      url: 'https://www.youtube.com/watch?v=1',
      cardId: 'c1',
      tracks: [{ videoId: '1', title: 'T' }],
      yotoToken: 't',
    })
    queue.enqueue({
      url: 'https://www.youtube.com/watch?v=2',
      cardId: 'c2',
      tracks: [{ videoId: '2', title: 'T' }],
      yotoToken: 't',
    })
    const id3 = queue.enqueue({
      url: 'https://www.youtube.com/watch?v=3',
      cardId: 'c3',
      tracks: [{ videoId: '3', title: 'T' }],
      yotoToken: 't',
    })

    expect(queue.getStatus(id3)).toBe('queued')
  })

  it('promotes queued jobs when running slots open', () => {
    const id1 = queue.enqueue({
      url: 'https://www.youtube.com/watch?v=1',
      cardId: 'c1',
      tracks: [{ videoId: '1', title: 'T' }],
      yotoToken: 't',
    })
    queue.enqueue({
      url: 'https://www.youtube.com/watch?v=2',
      cardId: 'c2',
      tracks: [{ videoId: '2', title: 'T' }],
      yotoToken: 't',
    })
    const id3 = queue.enqueue({
      url: 'https://www.youtube.com/watch?v=3',
      cardId: 'c3',
      tracks: [{ videoId: '3', title: 'T' }],
      yotoToken: 't',
    })

    expect(queue.getStatus(id3)).toBe('queued')

    // Complete the first job
    queue.markComplete(id1)

    // Third job should now be running
    expect(queue.getStatus(id3)).toBe('running')
  })

  it('cancels a running job', () => {
    const id = queue.enqueue({
      url: 'https://www.youtube.com/watch?v=1',
      cardId: 'c1',
      tracks: [{ videoId: '1', title: 'T' }],
      yotoToken: 't',
    })

    const cancelled = queue.cancel(id)
    expect(cancelled).toBe(true)
    expect(queue.getStatus(id)).toBe('cancelled')
  })

  it('cancels a queued job', () => {
    queue.enqueue({
      url: 'https://www.youtube.com/watch?v=1',
      cardId: 'c1',
      tracks: [{ videoId: '1', title: 'T' }],
      yotoToken: 't',
    })
    queue.enqueue({
      url: 'https://www.youtube.com/watch?v=2',
      cardId: 'c2',
      tracks: [{ videoId: '2', title: 'T' }],
      yotoToken: 't',
    })
    const id3 = queue.enqueue({
      url: 'https://www.youtube.com/watch?v=3',
      cardId: 'c3',
      tracks: [{ videoId: '3', title: 'T' }],
      yotoToken: 't',
    })

    const cancelled = queue.cancel(id3)
    expect(cancelled).toBe(true)
    expect(queue.getStatus(id3)).toBe('cancelled')
  })

  it('returns false when cancelling non-existent job', () => {
    expect(queue.cancel('non-existent')).toBe(false)
  })

  it('lists all active and queued jobs', () => {
    queue.enqueue({
      url: 'https://www.youtube.com/watch?v=1',
      cardId: 'c1',
      tracks: [{ videoId: '1', title: 'T' }],
      yotoToken: 't',
    })
    queue.enqueue({
      url: 'https://www.youtube.com/watch?v=2',
      cardId: 'c2',
      tracks: [{ videoId: '2', title: 'T' }],
      yotoToken: 't',
    })

    const jobs = queue.listJobs()
    expect(jobs).toHaveLength(2)
    expect(jobs.every((j: JobEntry) => j.status === 'running' || j.status === 'queued')).toBe(true)
  })

  it('cleans up completed jobs after delay', async () => {
    const id = queue.enqueue({
      url: 'https://www.youtube.com/watch?v=1',
      cardId: 'c1',
      tracks: [{ videoId: '1', title: 'T' }],
      yotoToken: 't',
    })

    queue.markComplete(id)

    // Job should still be accessible immediately
    expect(queue.getStatus(id)).toBe('complete')

    // After cleanup delay, job should be gone
    await new Promise((r) => setTimeout(r, 150))
    expect(queue.getStatus(id)).toBeUndefined()
  })

  it('fires onStart callback when a job transitions to running', () => {
    const onStart = vi.fn()
    queue = new JobQueue({ maxConcurrent: 1, cleanupDelayMs: 100, onStart })

    const id1 = queue.enqueue({
      url: 'https://www.youtube.com/watch?v=1',
      cardId: 'c1',
      tracks: [{ videoId: '1', title: 'T' }],
      yotoToken: 't',
    })

    expect(onStart).toHaveBeenCalledWith(id1)
  })
})
