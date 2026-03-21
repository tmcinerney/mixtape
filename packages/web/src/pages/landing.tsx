import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUploadFlow } from '../hooks/use-upload-flow'
import { useAddTrack } from '../hooks/use-add-track'
import { UrlInput } from '../components/url-input'
import { CardSelector } from '../components/card-selector'
import { UploadProgress } from '../components/upload-progress'
import { UploadConfirmation } from '../components/upload-confirmation'
import { CardGrid } from '../components/card-grid'
import { CreateCardDialog } from '../components/create-card-dialog'

export function LandingPage() {
  const { addTrack } = useAddTrack()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)

  // AIDEV-NOTE: onTrackReady is called by the upload flow hook when the SSE
  // stream reports completion. No useEffect needed — the hook drives the
  // transition directly via this callback.
  const handleTrackReady = useCallback(
    async (mediaUrl: string, cardId: string) => {
      await addTrack({ cardId, mediaUrl, title: 'New track' })
    },
    [addTrack],
  )

  const flow = useUploadFlow({ onTrackReady: handleTrackReady })

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>mixtape</h1>

      {flow.state === 'idle' ? <UrlInput onSubmit={flow.submitUrl} /> : null}

      {flow.state === 'selecting-card' ? (
        <CardSelector onSelect={flow.selectCard} onCancel={flow.reset} />
      ) : null}

      {flow.state === 'uploading' ? (
        <UploadProgress
          progress={flow.progress}
          title={flow.youtubeUrl ?? 'Processing...'}
          onCancel={flow.cancel}
        />
      ) : null}

      {flow.state === 'adding-track' ? <p>Adding track to card...</p> : null}

      {flow.state === 'complete' ? (
        <UploadConfirmation
          cardName={flow.cardId ?? 'Card'}
          trackTitle={flow.youtubeUrl ?? 'Track'}
          cardId={flow.cardId ?? ''}
          onViewCard={(id) => navigate(`/cards/${id}`)}
          onAddAnother={flow.reset}
        />
      ) : null}

      {flow.state === 'error' ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: 'red' }}>Error: {flow.error}</p>
          <button onClick={flow.reset}>Try Again</button>
        </div>
      ) : null}

      <div style={{ marginTop: '3rem' }}>
        <CardGrid onAddPlaylist={() => setShowCreate(true)} />
        <CreateCardDialog
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={() => setShowCreate(false)}
        />
      </div>
    </div>
  )
}
