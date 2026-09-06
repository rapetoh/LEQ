import { Navigate, Route, Routes } from 'react-router'
import { Connexion } from './auth/Connexion'
import { ExigerSession } from './auth/ExigerSession'
import { RoleGate } from './auth/RoleGate'
import { Layout } from './Layout'
import { Accueil } from './pages/Accueil'
import { Configuration } from './pages/configuration/Configuration'
import { Drapeaux } from './pages/Drapeaux'

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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
