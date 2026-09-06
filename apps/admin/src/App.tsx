import { Navigate, Route, Routes } from 'react-router'
import { Connexion } from './auth/Connexion'
import { ExigerSession } from './auth/ExigerSession'
import { RoleGate } from './auth/RoleGate'
import { Layout } from './Layout'
import { Accueil } from './pages/Accueil'
import { Configuration } from './pages/configuration/Configuration'
import { Drapeaux } from './pages/Drapeaux'
import { Defis } from './pages/banques/Defis'
import { EditionDefi } from './pages/banques/EditionDefi'
import { Exercices } from './pages/banques/Exercices'

/** Every page except the login sits behind a session and the admin role. */
export function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Connexion />} />
      <Route
        element={
          <ExigerSession>
            <RoleGate>
              <Layout />
            </RoleGate>
          </ExigerSession>
        }
      >
        <Route index element={<Accueil />} />
        <Route path="configuration" element={<Configuration />} />
        <Route path="drapeaux" element={<Drapeaux />} />
        <Route path="defis" element={<Defis />} />
        <Route path="defis/nouveau" element={<EditionDefi />} />
        <Route path="defis/:id" element={<EditionDefi />} />
        <Route path="exercices" element={<Exercices />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
