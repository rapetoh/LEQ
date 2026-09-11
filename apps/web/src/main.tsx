import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'

import { App } from './App'
import './styles/global.css'

const racine = document.getElementById('racine')
if (!racine) throw new Error('Élément #racine introuvable')

createRoot(racine).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
