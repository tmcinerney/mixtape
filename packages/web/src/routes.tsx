import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { CardGrid } from './components/card-grid'
import { CreateCardDialog } from './components/create-card-dialog'
import { CardEditor } from './pages/card-editor'

// AIDEV-NOTE: Landing page shows a URL input placeholder (Phase 8) and the card grid.
// The CreateCardDialog is opened via the "Add Playlist" card in the grid.
function LandingPage() {
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div>
      {/* AIDEV-TODO: URL input area — Phase 8 */}
      <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px dashed #ccc' }}>
        <p style={{ opacity: 0.5 }}>URL input coming in Phase 8</p>
      </div>

      <CardGrid onAddPlaylist={() => setShowCreate(true)} />
      <CreateCardDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => setShowCreate(false)}
      />
    </div>
  )
}

// AIDEV-NOTE: Auth0 processes the callback params automatically via the provider.
// This component just waits for that to finish, then redirects to /.
function CallbackPage() {
  const { isLoading, isAuthenticated, error } = useAuth0()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isLoading, isAuthenticated, navigate])

  if (error) {
    return <div>Login failed: {error.message}</div>
  }

  return <div>Completing login...</div>
}

export const routes: RouteObject[] = [
  { path: '/', element: <LandingPage /> },
  { path: '/cards/:cardId', element: <CardEditor /> },
  { path: '/callback', element: <CallbackPage /> },
]
