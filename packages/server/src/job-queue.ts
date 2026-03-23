import type { JobStatus } from '@mixtape/shared'

export interface ImportRequest {
  url: string
  cardId?: string
  cardTitle?: string
  coverUrl?: string
  tracks: Array<{ videoId: string; title: string }>
  yotoToken: string
}

export interface JobEntry {
  id: string
  request: ImportRequest
  status: JobStatus
  abortController: AbortController
  createdAt: number
}

interface QueueOptions {
  maxConcurrent?: number
  cleanupDelayMs?: number
  onStart?: (jobId: string) => void
}

// AIDEV-NOTE: Simple in-memory queue. No persistence across restarts.
// For a personal tool this is fine; a production system would use Redis/DB.
export class JobQueue {
  private jobs = new Map<string, JobEntry>()
  private maxConcurrent: number
  private cleanupDelayMs: number
  private onStart: ((jobId: string) => void) | undefined

  constructor(options: QueueOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 3
    this.cleanupDelayMs = options.cleanupDelayMs ?? 5 * 60 * 1000
    this.onStart = options.onStart
  }

  enqueue(request: ImportRequest): string {
    const id = crypto.randomUUID()
    const entry: JobEntry = {
      id,
      request,
      status: 'queued',
      abortController: new AbortController(),
      createdAt: Date.now(),
    }

    this.jobs.set(id, entry)
    this.tryPromote()

    return id
  }

  cancel(jobId: string): boolean {
    const entry = this.jobs.get(jobId)
    if (!entry) return false
    if (entry.status === 'complete' || entry.status === 'failed' || entry.status === 'cancelled') {
      return false
    }

    entry.abortController.abort()
    entry.status = 'cancelled'
    this.scheduleCleanup(jobId)

    // If a running job was cancelled, promote next queued job
    this.tryPromote()

    return true
  }

  getStatus(jobId: string): JobStatus | undefined {
    return this.jobs.get(jobId)?.status
  }

  getEntry(jobId: string): JobEntry | undefined {
    return this.jobs.get(jobId)
  }

  listJobs(): JobEntry[] {
    return [...this.jobs.values()].filter((j) => j.status === 'running' || j.status === 'queued')
  }

  markComplete(jobId: string): void {
    const entry = this.jobs.get(jobId)
    if (entry) {
      entry.status = 'complete'
      this.scheduleCleanup(jobId)
      this.tryPromote()
    }
  }

  markFailed(jobId: string): void {
    const entry = this.jobs.get(jobId)
    if (entry) {
      entry.status = 'failed'
      this.scheduleCleanup(jobId)
      this.tryPromote()
    }
  }

  private get runningCount(): number {
    return [...this.jobs.values()].filter((j) => j.status === 'running').length
  }

  private tryPromote(): void {
    while (this.runningCount < this.maxConcurrent) {
      const next = [...this.jobs.values()].find((j) => j.status === 'queued')
      if (!next) break
      next.status = 'running'
      this.onStart?.(next.id)
    }
  }

  private scheduleCleanup(jobId: string): void {
    setTimeout(() => {
      this.jobs.delete(jobId)
    }, this.cleanupDelayMs)
  }
}
