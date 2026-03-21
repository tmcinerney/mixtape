import type { RouteObject } from 'react-router-dom'

// AIDEV-NOTE: placeholder pages — will be replaced with real components in later phases
function LandingPage() {
  return <h1>mixtape</h1>
}

function CardEditor() {
  return <h1>Card Editor</h1>
}

function CallbackPage() {
  return <div>Completing login...</div>
}

export const routes: RouteObject[] = [
  { path: '/', element: <LandingPage /> },
  { path: '/cards/:cardId', element: <CardEditor /> },
  { path: '/callback', element: <CallbackPage /> },
]
