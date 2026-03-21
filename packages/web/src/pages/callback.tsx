import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'

// AIDEV-NOTE: Auth0 processes the callback params automatically via the provider.
// This component just waits for that to finish, then redirects to /.
export function CallbackPage() {
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
