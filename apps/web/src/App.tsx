import { Navigate, Route, Routes } from 'react-router'

import { Confidentialite } from './pages/Confidentialite'
import { Conditions } from './pages/Conditions'
import { Duel } from './pages/Duel'

/**
 * The public surface of LEQ: the duel invitation, which must work without the application
 * (cahier chapter 11), and the two legal pages the stores require.
 */
export function App() {
  return (
    <Routes>
      <Route path="/duel/:jeton" element={<Duel />} />
      <Route path="/confidentialite" element={<Confidentialite />} />
      <Route path="/conditions" element={<Conditions />} />
      <Route path="*" element={<Navigate to="/confidentialite" replace />} />
    </Routes>
  )
}
