import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { MetadataResponse } from '@mixtape/shared'

import { ImportConfirm } from '../components/import-confirm'

const playlistMetadata: MetadataResponse = {
  type: 'playlist',
  title: 'My Playlist',
  suggestedTitle: 'My Playlist',
  coverOptions: ['https://example.com/cover1.jpg', 'https://example.com/cover2.jpg'],
  totalDuration: 3600,
  tracks: [
    { videoId: 'a', title: 'Track A', suggestedTitle: 'Track A', duration: 180 },
    { videoId: 'b', title: 'Track B', suggestedTitle: 'Track B', duration: 240 },
    { videoId: 'c', title: 'Track C', suggestedTitle: 'Track C', duration: 300 },
  ],
}

const singleMetadata: MetadataResponse = {
  type: 'video',
  title: 'Single Song',
  suggestedTitle: 'Single Song',
  coverOptions: ['https://example.com/cover.jpg'],
  totalDuration: 200,
  tracks: [{ videoId: 'x', title: 'Single Song', suggestedTitle: 'Single Song', duration: 200 }],
}

const defaultProps = {
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
  onRefreshCovers: vi.fn().mockResolvedValue([]),
}

describe('ImportConfirm', () => {
  it('renders card title from metadata', () => {
    render(<ImportConfirm metadata={playlistMetadata} {...defaultProps} />)

    const input = screen.getByDisplayValue('My Playlist')
    expect(input).toBeInTheDocument()
  })

  it('renders track count for playlists', () => {
    render(<ImportConfirm metadata={playlistMetadata} {...defaultProps} />)

    expect(screen.getByText(/3 tracks/)).toBeInTheDocument()
  })

  it('shows truncation warning when truncatedAt is set', () => {
    const truncated = { ...playlistMetadata, truncatedAt: 50 }
    render(<ImportConfirm metadata={truncated} {...defaultProps} />)

    expect(screen.getByText(/truncated/i)).toBeInTheDocument()
  })

  it('calls onConfirm with correct params on button click', () => {
    const onConfirm = vi.fn()
    render(<ImportConfirm metadata={playlistMetadata} {...defaultProps} onConfirm={onConfirm} />)

    fireEvent.click(screen.getByText('Import 3 Tracks'))
    expect(onConfirm).toHaveBeenCalledWith({
      cardTitle: 'My Playlist',
      coverUrl: 'https://example.com/cover1.jpg',
      tracks: [
        { videoId: 'a', title: 'Track A' },
        { videoId: 'b', title: 'Track B' },
        { videoId: 'c', title: 'Track C' },
      ],
    })
  })

  it('calls onCancel on cancel click', () => {
    const onCancel = vi.fn()
    render(<ImportConfirm metadata={playlistMetadata} {...defaultProps} onCancel={onCancel} />)

    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('shows Create & Add button for single track', () => {
    render(<ImportConfirm metadata={singleMetadata} {...defaultProps} />)

    expect(screen.getByText('Create & Add')).toBeInTheDocument()
  })

  it('shows editable track title for single track', () => {
    render(<ImportConfirm metadata={singleMetadata} {...defaultProps} />)

    const inputs = screen.getAllByDisplayValue('Single Song')
    expect(inputs).toHaveLength(2) // card title + track title
    expect(screen.getByText('Track Title')).toBeInTheDocument()
  })
})
