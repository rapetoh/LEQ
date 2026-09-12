import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import type { AuthError } from '@supabase/supabase-js'
import { fr } from '../fr'
import { supabase } from '../services/supabase'
import { useSession } from './sessionContext'
import styles from './Connexion.module.css'

/** Reads the path stored by ExigerSession, defaulting to the home page. */
function destinationDepuis(etat: unknown): string {
  if (etat && typeof etat === 'object' && 'de' in etat) {
    const de: unknown = etat.de
    if (typeof de === 'string' && de.startsWith('/') && de !== '/connexion') return de
  }
  return '/'
}

function estIdentifiantsIncorrects(erreur: AuthError): boolean {
  return erreur.code === 'invalid_credentials' || erreur.status === 400
}

export function Connexion() {
  const { statut, session } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const destination = destinationDepuis(location.state)

  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  if (statut === 'pret' && session) {
    return <Navigate to={destination} replace />
  }

  async function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    setErreur(null)
    setEnCours(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: motDePasse,
    })

    setEnCours(false)

    if (error) {
      setErreur(
        estIdentifiantsIncorrects(error)
          ? fr.connexion.identifiantsIncorrects
          : fr.connexion.indisponible,
      )
      return
    }

    void navigate(destination, { replace: true })
  }

  return (
    <main className={styles.page}>
      <form className={styles.boite} onSubmit={soumettre} noValidate>
        <img
          className={styles.sigle}
          src={`${import.meta.env.BASE_URL}marque/sigle-bleu-nuit.png`}
          alt={fr.app.nom}
        />
        <h1>{fr.app.sousTitre}</h1>
        <p className={styles.intro}>{fr.connexion.intro}</p>

        <div className={styles.champs}>
          <div>
            <label className="etiquette" htmlFor="email">
              {fr.connexion.email}
            </label>
            <input
              id="email"
              className="champ"
              type="email"
              name="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={enCours}
            />
          </div>
          <div>
            <label className="etiquette" htmlFor="mot-de-passe">
              {fr.connexion.motDePasse}
            </label>
            <input
              id="mot-de-passe"
              className="champ"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              disabled={enCours}
            />
          </div>
        </div>

        {erreur ? (
          <p className={styles.erreur} role="alert">
            {erreur}
          </p>
        ) : null}

        <button
          type="submit"
          className="bouton bouton-principal"
          disabled={enCours || email.trim() === '' || motDePasse === ''}
        >
          {enCours ? fr.connexion.enCours : fr.connexion.valider}
        </button>
      </form>
    </main>
  )
}
