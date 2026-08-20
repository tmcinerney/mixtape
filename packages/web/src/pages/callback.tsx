import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authClient } from '../auth/auth-client'

// AIDEV-NOTE: This page now does the work. Under @auth0/auth0-react the provider
// consumed the callback params on its own and this component only waited. With the
// hand-rolled flow the code-for-token exchange happens here.
export function CallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  // AIDEV-NOTE: StrictMode double-invokes effects in dev and an authorization code is
  // single-use — the second exchange would fail with invalid_grant and strand the user.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    authClient
      .handleRedirectCallback(window.location.search)
      .then((returnTo) => navigate(returnTo, { replace: true }))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Login failed')
      })
  }, [navigate])

  if (error) {
    return (
      <div>
        <p>Login failed: {error}</p>
        <button onClick={() => void authClient.loginWithRedirect('/')}>Try again</button>
      </div>
    )
  }

  return <div>Completing login...</div>
}
