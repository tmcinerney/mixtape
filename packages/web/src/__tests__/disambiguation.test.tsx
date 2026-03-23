import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Disambiguation } from '../components/disambiguation'

describe('Disambiguation', () => {
  it('renders two choice buttons', () => {
    render(<Disambiguation videoId="abc" listId="xyz" onChoose={vi.fn()} />)

    expect(screen.getByText('Import full playlist')).toBeInTheDocument()
    expect(screen.getByText('Just this video')).toBeInTheDocument()
  })

  it('calls onChoose with "playlist" when playlist button is clicked', () => {
    const onChoose = vi.fn()
    render(<Disambiguation videoId="abc" listId="xyz" onChoose={onChoose} />)

    fireEvent.click(screen.getByText('Import full playlist'))
    expect(onChoose).toHaveBeenCalledWith('playlist')
  })

  it('calls onChoose with "video" when video button is clicked', () => {
    const onChoose = vi.fn()
    render(<Disambiguation videoId="abc" listId="xyz" onChoose={onChoose} />)

    fireEvent.click(screen.getByText('Just this video'))
    expect(onChoose).toHaveBeenCalledWith('video')
  })
})
