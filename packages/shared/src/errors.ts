export enum YtdlpErrorCode {
  VIDEO_PRIVATE = 'VIDEO_PRIVATE',
  VIDEO_AGE_RESTRICTED = 'VIDEO_AGE_RESTRICTED',
  VIDEO_REGION_LOCKED = 'VIDEO_REGION_LOCKED',
  VIDEO_NOT_FOUND = 'VIDEO_NOT_FOUND',
  VIDEO_TOO_LONG = 'VIDEO_TOO_LONG',
  DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
}

export class PipelineError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'PipelineError'
  }
}
