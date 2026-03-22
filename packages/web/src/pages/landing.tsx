import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { useUploadFlow } from '../hooks/use-upload-flow'
import { useAddTrack } from '../hooks/use-add-track'
import { UrlInput } from '../components/url-input'
import { CardSelector } from '../components/card-selector'
import { UploadProgress } from '../components/upload-progress'
import { TrackConfirm } from '../components/track-confirm'
import { UploadConfirmation } from '../components/upload-confirmation'
import { CardGrid } from '../components/card-grid'
import { CreateCardDialog } from '../components/create-card-dialog'
import '../styles/landing.css'

export function LandingPage() {
  const { isAuthenticated } = useAuth0()
  const { addTrack } = useAddTrack()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  // AIDEV-NOTE: Track the confirmed title so we can show it in the success screen.
  const confirmedTitleRef = useRef('Track')

  const handleTrackReady = useCallback(
    async (params: { mediaUrl: string; cardId: string; title: string; iconUrl?: string }) => {
      confirmedTitleRef.current = params.title
      await addTrack({
        cardId: params.cardId,
        mediaUrl: params.mediaUrl,
        title: params.title,
        ...(params.iconUrl !== undefined ? { iconUrl: params.iconUrl } : {}),
      })
    },
    [addTrack],
  )

  const flow = useUploadFlow({ onTrackReady: handleTrackReady })

  return (
    <div className={`landing${!isAuthenticated ? ' landing--centered' : ''}`}>
      <div className="landing-hero">
        <h1 className="landing-heading">
          Make <span className="accent">mixtapes</span> for your{' '}
          <span className="accent">Yoto cards</span>.
        </h1>

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

        {flow.state === 'confirming' && flow.confirmData ? (
          <TrackConfirm
            data={flow.confirmData}
            onConfirm={flow.confirmTrack}
            onCancel={flow.reset}
          />
        ) : null}

        {flow.state === 'adding-track' ? (
          <p className="landing-adding">Adding track to card...</p>
        ) : null}

        {flow.state === 'complete' ? (
          <UploadConfirmation
            cardName={flow.cardId ?? 'Card'}
            trackTitle={confirmedTitleRef.current}
            cardId={flow.cardId ?? ''}
            onViewCard={(id) => navigate(`/cards/${id}`)}
            onAddAnother={flow.reset}
          />
        ) : null}

        {flow.state === 'error' ? (
          <div className="landing-error">
            <p>Error: {flow.error}</p>
            <button className="btn-secondary" onClick={flow.reset}>
              Try Again
            </button>
          </div>
        ) : null}
      </div>

      <div className="landing-cards-section">
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
