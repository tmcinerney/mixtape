import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { JobProgress } from '@mixtape/shared'

import { UploadProgress } from '../components/upload-progress'

describe('UploadProgress', () => {
  it('renders three progress steps', () => {
    render(<UploadProgress progress={null} title="Test Video" onCancel={vi.fn()} />)

    expect(screen.getByText('Download')).toBeInTheDocument()
    expect(screen.getByText('Convert')).toBeInTheDocument()
    expect(screen.getByText('Upload')).toBeInTheDocument()
  })

  it('shows the video title', () => {
    render(<UploadProgress progress={null} title="My Cool Video" onCancel={vi.fn()} />)

    expect(screen.getByText('My Cool Video')).toBeInTheDocument()
  })

  it('highlights the download step when downloading', () => {
    const progress: JobProgress = { step: 'download', progress: 45 }
    render(<UploadProgress progress={progress} title="Test" onCancel={vi.fn()} />)

    expect(screen.getByText('Download')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('45%')).toBeInTheDocument()
  })

  it('highlights the convert step when converting', () => {
    const progress: JobProgress = { step: 'convert', progress: 70 }
    render(<UploadProgress progress={progress} title="Test" onCancel={vi.fn()} />)

    expect(screen.getByText('Convert')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('70%')).toBeInTheDocument()
  })

  it('highlights the upload step when uploading', () => {
    const progress: JobProgress = { step: 'upload', progress: 30 }
    render(<UploadProgress progress={progress} title="Test" onCancel={vi.fn()} />)

    expect(screen.getByText('Upload')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('30%')).toBeInTheDocument()
  })

  // AIDEV-NOTE: transcode maps to upload step in the 3-step UI
  it('maps transcode step to upload in UI', () => {
    const progress: JobProgress = { step: 'transcode', progress: 50 }
    render(<UploadProgress progress={progress} title="Test" onCancel={vi.fn()} />)

    expect(screen.getByText('Upload')).toHaveAttribute('aria-current', 'step')
  })

  it('calls onCancel when cancel link is clicked', () => {
    const onCancel = vi.fn()
    render(<UploadProgress progress={null} title="Test" onCancel={onCancel} />)

    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
