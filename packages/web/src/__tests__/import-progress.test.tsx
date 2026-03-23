import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ImportProgress } from '../components/import-progress'

const multiTrackProps = {
  currentTrack: 3,
  totalTracks: 20,
  currentTitle: 'Current Song',
  trackProgress: { step: 'download', progress: 45 },
  completedTracks: [
    { title: 'Song 1', status: 'done' as const },
    { title: 'Song 2', status: 'skipped' as const, reason: 'Already exists' },
  ],
  onCancel: vi.fn(),
}

describe('ImportProgress', () => {
  it('shows "Track X of Y" for multi-track', () => {
    render(<ImportProgress {...multiTrackProps} />)

    expect(screen.getByText('Track 3 of 20')).toBeInTheDocument()
  })

  it('does not show counter for single track', () => {
    render(
      <ImportProgress
        currentTrack={1}
        totalTracks={1}
        currentTitle="Only Song"
        trackProgress={{ step: 'download', progress: 50 }}
        completedTracks={[]}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.queryByText(/Track \d+ of \d+/)).not.toBeInTheDocument()
  })

  it('shows step indicators', () => {
    render(<ImportProgress {...multiTrackProps} />)

    // Current title appears in both cassette label and progress title
    expect(screen.getAllByText('Current Song').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Downloading/)).toBeInTheDocument()
  })

  it('shows completed tracks list', () => {
    render(<ImportProgress {...multiTrackProps} />)

    expect(screen.getByText('Song 1')).toBeInTheDocument()
    expect(screen.getByText('Song 2')).toBeInTheDocument()
  })

  it('calls onCancel when cancel is clicked', () => {
    const onCancel = vi.fn()
    render(<ImportProgress {...multiTrackProps} onCancel={onCancel} />)

    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
