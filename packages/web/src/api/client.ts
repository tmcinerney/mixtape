import type { JobRequest } from '@mixtape/shared'

const API_BASE = '/api'

/**
 * Starts a job and returns an EventSource for SSE progress updates.
 *
 * AIDEV-NOTE: uses fetch POST to create the job, then opens an EventSource
 * on the returned job URL for streaming progress.
 */
export async function startJob(
  params: JobRequest,
  token: string,
): Promise<{ jobId: string; eventSource: EventSource }> {
  const res = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    throw new Error(`Failed to start job: ${res.status} ${res.statusText}`)
  }

  const data = (await res.json()) as { jobId: string }
  const eventSource = new EventSource(`${API_BASE}/jobs/${data.jobId}/events`)

  return { jobId: data.jobId, eventSource }
}

/**
 * Cancels a running job.
 */
export async function cancelJob(jobId: string, token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    throw new Error(`Failed to cancel job: ${res.status} ${res.statusText}`)
  }
}
