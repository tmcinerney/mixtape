import { useEffect, useRef, useState } from 'react'
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
  const flow = useUploadFlow()
  const { addTrack } = useAddTrack()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)

  // AIDEV-NOTE: when card is selected during upload flow AND we have a mediaUrl
  // from a completed job, add the track to the card automatically
  async function handleCardSelect(cardId: string) {
    flow.selectCard(cardId)
  }

  // AIDEV-NOTE: called when SSE stream reports complete step with mediaUrl
  // This is wired through the flow hook's adding-track state
  async function handleAddTrack() {
    if (!flow.mediaUrl || !flow.cardId) return
    try {
      await addTrack({
        cardId: flow.cardId,
        mediaUrl: flow.mediaUrl,
        title: flow.youtubeUrl ?? 'Unknown',
      })
      flow.markComplete()
    } catch {
      // error is surfaced via useAddTrack
    }
  }

  // AIDEV-NOTE: Auto-trigger track addition when entering adding-track state.
  // Must be in useEffect to avoid infinite re-render loop.
  const addingRef = useRef(false)
  useEffect(() => {
    if (flow.state === 'adding-track' && flow.mediaUrl && flow.cardId && !addingRef.current) {
      addingRef.current = true
      handleAddTrack().finally(() => {
        addingRef.current = false
      })
    }
  }, [flow.state, flow.mediaUrl, flow.cardId])

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>mixtape</h1>

      {flow.state === 'idle' && <UrlInput onSubmit={flow.submitUrl} />}

      {flow.state === 'selecting-card' && (
        <CardSelector onSelect={handleCardSelect} onCancel={flow.reset} />
      )}

      {flow.state === 'uploading' && (
        <UploadProgress
          progress={flow.progress}
          title={flow.youtubeUrl ?? 'Processing...'}
          onCancel={flow.cancel}
        />
      )}

      {flow.state === 'adding-track' && <p>Adding track to card...</p>}

      {flow.state === 'complete' && (
        <UploadConfirmation
          cardName={flow.cardId ?? 'Card'}
          trackTitle={flow.youtubeUrl ?? 'Track'}
          cardId={flow.cardId ?? ''}
          onViewCard={(id) => navigate(`/cards/${id}`)}
          onAddAnother={flow.reset}
        />
      )}

      {flow.state === 'error' && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: 'red' }}>Error: {flow.error}</p>
          <button onClick={flow.reset}>Try Again</button>
        </div>
      )}

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
