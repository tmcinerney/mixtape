export interface JobRequest {
  youtubeUrl: string
  cardId: string
}

export interface JobProgress {
  jobId: string
  step: 'downloading' | 'uploading' | 'transcoding' | 'complete' | 'error'
  progress?: number
  message?: string
  error?: string
}
