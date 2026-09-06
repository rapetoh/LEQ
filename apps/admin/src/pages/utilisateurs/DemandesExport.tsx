import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useSession } from '../../auth/sessionContext'
import { useNotifier } from '../../composants/toastContext'
import { fr } from '../../fr'
import {
  chargerDemandesExport,
  cleRequeteDemandesExport,
  marquerDemandeTraitee,
} from '../../services/exports'
import styles from '../banques/Banques.module.css'

function formaterDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

/** The inbox of chapter 2: people who asked for a copy of their data; Rebecca answers by e-mail. */
export function DemandesExport() {
  const { session } = useSession()
  const notifier = useNotifier()
  const clientRequetes = useQueryClient()
  const demandes = useQuery({ queryKey: cleRequeteDemandesExport, queryFn: chargerDemandesExport })
  const [afficherTraitees, setAfficherTraitees] = useState(false)
  const traitement = useMutation({
    mutationFn: ({ id, traitee }: { id: string; traitee: boolean }) =>
      marquerDemandeTraitee(id, session?.user.id ?? '', traitee),
    onSuccess: () => {
      notifier({ type: 'succes', message: fr.exports.misAJour })
      return clientRequetes.invalidateQueries({ queryKey: cleRequeteDemandesExport })
    },
    onError: (e: Error) =>
      notifier({ type: 'erreur', message: fr.exports.erreur, details: e.message }),
  })
  const lignes = (demandes.data ?? []).filter((d) => afficherTraitees || d.traitee_le === null)

  return (
    <div className="page">
      <header className={styles.entete}>
        <div>
          <h1>{fr.exports.titre}</h1>
          <p>{fr.exports.intro}</p>
        </div>
        <button
          type="button"
          className="bouton bouton-secondaire"
          aria-pressed={afficherTraitees}
          onClick={() => setAfficherTraitees((v) => !v)}
        >
          {afficherTraitees ? fr.exports.masquerTraitees : fr.exports.voirTraitees}
        </button>
      </header>
      {demandes.isPending ? (
        <p className="etat" role="status">
          {fr.commun.chargement}
        </p>
      ) : demandes.isError ? (
        <div className="etat etat-erreur" role="alert">
          <p>{fr.exports.erreurChargement}</p>
          <p className="mono">{demandes.error.message}</p>
        </div>
      ) : lignes.length === 0 ? (
        <p className="etat">{fr.exports.vide}</p>
      ) : (
        <div className={`carte ${styles.liste}`}>
          {lignes.map((d) => (
            <div
              key={d.id}
              className={`${styles.ligne} ${d.traitee_le ? styles.ligneInactive : ''}`}
            >
              <span className={styles.ordre}>{formaterDate(d.cree_le)}</span>
              <div>
                <span className={styles.titre}>{d.email ?? fr.exports.sansEmail}</span>
                <p className={styles.detail}>
                  {d.profils?.prenom ?? fr.utilisateurs.sansPrenom} ·{' '}
                  <span className="mono">{d.utilisateur_id}</span>
                  {d.traitee_le ? ` · ${fr.exports.traiteeLe(formaterDate(d.traitee_le))}` : ''}
                </p>
              </div>
              <div className={styles.badges}>
                <span className={d.traitee_le ? styles.badgeValide : styles.badge}>
                  {d.traitee_le ? fr.exports.traitee : fr.exports.aTraiter}
                </span>
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={`bouton ${d.traitee_le ? 'bouton-discret' : 'bouton-secondaire'}`}
                  disabled={traitement.isPending}
                  onClick={() => traitement.mutate({ id: d.id, traitee: d.traitee_le === null })}
                >
                  {d.traitee_le ? fr.exports.rouvrir : fr.exports.marquerTraitee}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
