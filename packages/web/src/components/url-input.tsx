import { useState, type FormEvent } from 'react'
import '../styles/url-input.css'

// AIDEV-NOTE: matches both youtube.com/watch and youtu.be short URLs
const YOUTUBE_URL_RE = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/

interface UrlInputProps {
  onSubmit: (url: string) => void
  disabled?: boolean
}

export function UrlInput({ onSubmit, disabled }: UrlInputProps) {
  const [url, setUrl] = useState('')

  const isValid = YOUTUBE_URL_RE.test(url)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValid || disabled) return
    onSubmit(url)
    setUrl('')
  }

  return (
    <form onSubmit={handleSubmit} className="url-form">
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste a YouTube URL..."
        disabled={disabled}
        className="url-input"
      />
      <button type="submit" disabled={!isValid || disabled} className="btn-primary">
        Add to mixtape
      </button>
    </form>
  )
}
