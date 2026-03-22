import { useParams, useNavigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { useCardEditor } from '../hooks/use-card-editor'
import { TrackList } from '../components/track-list'
import { ErrorState } from '../components/error-state'
import { Skeleton, TrackListSkeleton } from '../components/skeleton'
import '../styles/card-editor.css'

export function CardEditor() {
  const { cardId } = useParams<{ cardId: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading: authLoading, loginWithRedirect } = useAuth0()

  const {
    card,
    title,
    setTitle,
    tracks,
    setTracks,
    loading,
    saving,
    error,
    handleTitleChange,
    handleDelete,
    handleSave,
  } = useCardEditor(cardId)

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
          <Skeleton width="100%" height="2em" radius="var(--radius-full)" />
        </div>
        <div className="card-editor-tracks">
          <Skeleton width="80px" height="1.5em" radius="var(--radius-sm)" />
          <TrackListSkeleton />
        </div>
      </div>
    )
  }

  if (!card) {
    return <div>Card not found</div>
  }

  const metadata = card.metadata as { icon?: string; color?: string }

  const onSave = async () => {
    await handleSave()
    navigate('/')
  }

  return (
    <div className="card-editor">
      {/* Left column: card preview */}
      <div className="card-editor-preview">
        <div
          className="card-editor-artwork"
          style={{ backgroundColor: metadata.color ?? '#6366F1' }}
        >
          {metadata.icon ? (
            <img src={metadata.icon} alt="Card icon" className="card-editor-artwork-icon" />
          ) : null}
        </div>
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
        <button className="btn-secondary card-editor-change-icon">Change icon</button>
      </div>

      {/* Right column: track list */}
      <div className="card-editor-tracks">
        <h2>Tracks</h2>
        <TrackList
          tracks={tracks}
          onReorder={setTracks}
          onDelete={handleDelete}
          onTitleChange={handleTitleChange}
        />

        <div className="card-editor-actions">
          <button className="btn-primary" onClick={onSave} disabled={saving} aria-label="Save">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button className="btn-ghost" onClick={() => navigate('/')} aria-label="Cancel">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
