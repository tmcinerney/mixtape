import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { useImportFlow } from '../hooks/use-import-flow'
import { UrlInput } from '../components/url-input'
import { Disambiguation } from '../components/disambiguation'
import { ImportConfirm } from '../components/import-confirm'
import { ImportProgress } from '../components/import-progress'
import { ImportComplete } from '../components/import-complete'
import { CardGrid } from '../components/card-grid'
import { CreateCardDialog } from '../components/create-card-dialog'
import { CassetteLoader } from '../components/cassette-loader'
import { matchCover } from '../api/client'
import '../styles/landing.css'

export function LandingPage() {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const flow = useImportFlow()

  const handleRefreshCovers = async (title: string): Promise<string[]> => {
    const token = await getAccessTokenSilently()
    return matchCover(title, token)
  }

  return (
    <div className={`landing${!isAuthenticated ? ' landing--centered' : ''}`}>
      <div className="landing-hero">
        <h1 className="landing-heading">
          Make <span className="accent">mixtapes</span> for your{' '}
          <span className="accent">Yoto cards</span>.
        </h1>

        {flow.state === 'idle' ? <UrlInput onSubmit={flow.submitUrl} /> : null}

        {flow.state === 'disambiguating' && flow.ambiguousUrl ? (
          <Disambiguation
            videoId={flow.ambiguousUrl.videoId}
            listId={flow.ambiguousUrl.listId}
            onChoose={flow.disambiguate}
          />
        ) : null}

        {flow.state === 'extracting' ? (
          <div className="landing-extracting">
            <CassetteLoader progress={0} />
            <p>Fetching info...</p>
          </div>
        ) : null}

        {flow.state === 'confirming' && flow.metadata ? (
          <ImportConfirm
            metadata={flow.metadata}
            onConfirm={flow.confirmImport}
            onCancel={flow.reset}
            onRefreshCovers={handleRefreshCovers}
          />
        ) : null}

        {flow.state === 'importing' ? (
          <ImportProgress
            currentTrack={flow.progress?.currentTrack ?? 0}
            totalTracks={flow.progress?.totalTracks ?? 1}
            currentTitle={flow.progress?.currentTitle ?? 'Processing...'}
            trackProgress={flow.progress?.trackProgress ?? null}
            completedTracks={flow.completedTracks}
            onCancel={flow.cancel}
          />
        ) : null}

        {flow.state === 'complete' && flow.result ? (
          <ImportComplete
            cardId={flow.result.cardId}
            imported={flow.result.imported}
            total={flow.result.imported + flow.result.skipped.length}
            skipped={flow.result.skipped}
            onViewCard={(id) => navigate(`/cards/${id}`)}
            onImportAnother={flow.reset}
          />
        ) : null}

        {flow.state === 'cancelled' && flow.result ? (
          <ImportComplete
            cardId={flow.result.cardId}
            imported={flow.result.imported}
            total={flow.result.imported + flow.result.skipped.length}
            skipped={flow.result.skipped}
            cancelled
            onViewCard={(id) => navigate(`/cards/${id}`)}
            onImportAnother={flow.reset}
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
          onCreated={(cardId) => {
            setShowCreate(false)
            navigate(`/cards/${cardId}`)
          }}
        />
      </div>
    </div>
  )
}
