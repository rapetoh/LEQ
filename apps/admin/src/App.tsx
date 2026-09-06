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
import { Echanges } from './pages/banques/Echanges'
import { Exercices } from './pages/banques/Exercices'
import { Recompenses } from './pages/banques/Recompenses'
import { Annonces } from './pages/annonces/Annonces'
import { Ateliers } from './pages/annonces/Ateliers'
import { Grille } from './pages/grille/Grille'
import { DemandesExport } from './pages/utilisateurs/DemandesExport'
import { Utilisateurs } from './pages/utilisateurs/Utilisateurs'

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
        <Route path="recompenses" element={<Recompenses />} />
        <Route path="echanges" element={<Echanges />} />
        <Route path="grille" element={<Grille />} />
        <Route path="annonces" element={<Annonces />} />
        <Route path="ateliers" element={<Ateliers />} />
        <Route path="utilisateurs" element={<Utilisateurs />} />
        <Route path="exports" element={<DemandesExport />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
