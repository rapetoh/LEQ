import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import { SessionProvider } from './auth/SessionProvider'
import { ToastProvider } from './composants/Toasts'
import './styles/global.css'

// Vite writes BASE_URL with a trailing slash ('/admin/'); react-router needs it without, or the
// bare '/admin' matches no route and the page renders empty.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

const clientRequetes = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
})

const racine = document.getElementById('racine')
if (!racine) throw new Error('Élément #racine introuvable dans index.html.')

createRoot(racine).render(
  <StrictMode>
    <QueryClientProvider client={clientRequetes}>
      <SessionProvider>
        <ToastProvider>
          <BrowserRouter basename={BASE}>
            <App />
          </BrowserRouter>
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
)
