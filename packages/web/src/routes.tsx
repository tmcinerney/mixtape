import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'

// AIDEV-NOTE: placeholder pages — will be replaced with real components in later phases
function LandingPage() {
  return <h1>mixtape</h1>
}

function CardEditor() {
  return <h1>Card Editor</h1>
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
