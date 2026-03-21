import type { RouteObject } from 'react-router-dom'
import { LandingPage } from './pages/landing'
import { CardEditor } from './pages/card-editor'
import { CallbackPage } from './pages/callback'

export const routes: RouteObject[] = [
  { path: '/', element: <LandingPage /> },
  { path: '/cards/:cardId', element: <CardEditor /> },
  { path: '/callback', element: <CallbackPage /> },
]
