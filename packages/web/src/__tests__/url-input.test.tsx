import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { UrlInput } from '../components/url-input'

describe('UrlInput', () => {
  it('renders a text input and submit button', () => {
    render(<UrlInput onSubmit={vi.fn()} />)

    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add to mixtape/i })).toBeInTheDocument()
  })

  it('disables submit button when input is empty', () => {
    render(<UrlInput onSubmit={vi.fn()} />)

    expect(screen.getByRole('button', { name: /add to mixtape/i })).toBeDisabled()
  })

  it('disables submit button for invalid URLs', () => {
    render(<UrlInput onSubmit={vi.fn()} />)

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'https://example.com/video' },
    })

    expect(screen.getByRole('button', { name: /add to mixtape/i })).toBeDisabled()
  })

  it('enables submit button for valid youtube.com URLs', () => {
    render(<UrlInput onSubmit={vi.fn()} />)

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    })

    expect(screen.getByRole('button', { name: /add to mixtape/i })).toBeEnabled()
  })

  it('enables submit button for valid youtu.be URLs', () => {
    render(<UrlInput onSubmit={vi.fn()} />)

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'https://youtu.be/dQw4w9WgXcQ' },
    })

    expect(screen.getByRole('button', { name: /add to mixtape/i })).toBeEnabled()
  })

  it('calls onSubmit with the URL when form is submitted', () => {
    const onSubmit = vi.fn()
    render(<UrlInput onSubmit={onSubmit} />)

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add to mixtape/i }))

    expect(onSubmit).toHaveBeenCalledWith('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  })

  it('clears the input after successful submit', () => {
    render(<UrlInput onSubmit={vi.fn()} />)

    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add to mixtape/i }))

    expect(input.value).toBe('')
  })

  it('disables input and button when disabled prop is true', () => {
    render(<UrlInput onSubmit={vi.fn()} disabled />)

    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByRole('button', { name: /add to mixtape/i })).toBeDisabled()
  })
})
