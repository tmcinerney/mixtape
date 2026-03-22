import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import type { DisplayIcon } from '@yotoplay/yoto-sdk'
import { useCardEditor } from '../hooks/use-card-editor'
import { useIconResolver } from '../hooks/use-icon-resolver'
import { TrackList } from '../components/track-list'
import { IconPicker } from '../components/icon-picker'
import { ErrorState } from '../components/error-state'
import { SaveStatusIndicator } from '../components/save-status'
import { Skeleton, TrackListSkeleton } from '../components/skeleton'
import '../styles/card-editor.css'

export function CardEditor() {
  const { cardId } = useParams<{ cardId: string }>()
  const { isAuthenticated, isLoading: authLoading, loginWithRedirect } = useAuth0()
  const [showIconPicker, setShowIconPicker] = useState(false)

  const {
    card,
    title,
    setTitle,
    tracks,
    setTracks,
    loading,
    saveStatus,
    saveError,
    error,
    handleTitleChange,
    handleIconChange,
    handleDelete,
    retry,
  } = useCardEditor(cardId)

  const { resolve } = useIconResolver()

  // AIDEV-NOTE: Resolve yoto:#ref → display URL for tracks that have iconRef but no iconUrl.
  const resolvedTracks = useMemo(
    () =>
      tracks.map((t) => {
        if (t.iconUrl) return t
        if (!t.iconRef) return t
        const url = resolve(t.iconRef)
        return url !== undefined ? { ...t, iconUrl: url } : t
      }),
    [tracks, resolve],
  )

  if (authLoading) {
    return <div>Loading...</div>
  }

  if (!isAuthenticated) {
    return (
      <div className="card-editor-auth">
        <p>Sign in to edit cards</p>
        <button className="btn-primary" onClick={() => loginWithRedirect()}>
          Sign in
        </button>
      </div>
    )
  }

  if (error) {
    return <ErrorState message={error} />
  }

  if (loading) {
    return (
      <div className="card-editor">
        <div className="card-editor-preview">
          <Skeleton className="card-editor-artwork" />
        </div>
        <div className="card-editor-tracks">
          <Skeleton width="200px" height="2em" radius="var(--radius-sm)" />
          <TrackListSkeleton />
        </div>
      </div>
    )
  }

  if (!card) {
    return <div>Card not found</div>
  }

  const metadata = card.metadata as { icon?: string; color?: string; cover?: { imageL?: string } }
  const cardIconUrl = metadata.icon?.startsWith('yoto:#') ? resolve(metadata.icon) : metadata.icon
  // AIDEV-NOTE: metadata.cover.imageL is the full card cover image (same as shown on Yoto portal)
  const cardCoverUrl = metadata.cover?.imageL

  const handleCardIconSelect = (_icon: DisplayIcon) => {
    // AIDEV-TODO: wire card icon change through to save via useCardEditor
    // For now just close the picker — card icon editing needs a dedicated handler
    setShowIconPicker(false)
  }

  return (
    <div className="card-editor">
      {/* Left column: card artwork — clickable to change icon */}
      <div className="card-editor-preview">
        <button
          className="card-editor-artwork"
          style={{ backgroundColor: metadata.color ?? '#6366F1' }}
          onClick={() => setShowIconPicker(!showIconPicker)}
          aria-label="Change card icon"
        >
          {cardCoverUrl ? (
            <img src={cardCoverUrl} alt="Card cover" className="card-editor-artwork-cover" />
          ) : cardIconUrl ? (
            <img src={cardIconUrl} alt="Card icon" className="card-editor-artwork-icon" />
          ) : null}
          <span className="card-editor-artwork-overlay">Change</span>
        </button>
        {showIconPicker ? (
          <div className="card-editor-icon-picker">
            <IconPicker onSelect={handleCardIconSelect} />
          </div>
        ) : null}
      </div>

      {/* Right column: editable title + track list */}
      <div className="card-editor-tracks">
        <div className="card-editor-tracks-header">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            aria-label="Card title"
            className="card-editor-title-input"
          />
          <SaveStatusIndicator status={saveStatus} error={saveError} onRetry={retry} />
        </div>
        <TrackList
          tracks={resolvedTracks}
          onReorder={setTracks}
          onDelete={handleDelete}
          onTitleChange={handleTitleChange}
          onIconChange={handleIconChange}
        />

        <div className="card-editor-actions">
          <Link to="/" className="btn-ghost card-editor-back">
            Back
          </Link>
        </div>
      </div>
    </div>
  )
}
