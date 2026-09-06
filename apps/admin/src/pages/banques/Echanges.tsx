import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { DialogueConfirmation } from '../../composants/Dialogue'
import { useNotifier } from '../../composants/toastContext'
import { fr } from '../../fr'
import type { StatutEchange } from '../../modele/recompenses'
import {
  chargerEchanges,
  cleRequeteEchanges,
  traiterEchange,
  type EchangeAdmin,
} from '../../services/recompenses'
import styles from './Banques.module.css'

function formaterDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

/** What people exchanged their points for; Rebecca honours by hand, or cancels (points return). */
export function Echanges() {
  const notifier = useNotifier()
  const clientRequetes = useQueryClient()
  const echanges = useQuery({ queryKey: cleRequeteEchanges, queryFn: chargerEchanges })
  const [filtre, setFiltre] = useState<StatutEchange | 'tous'>('a_traiter')
  const [annulation, setAnnulation] = useState<EchangeAdmin | null>(null)

  const traitement = useMutation({
    mutationFn: traiterEchange,
    onSuccess: () => {
      notifier({ type: 'succes', message: fr.echanges.traite })
      return clientRequetes.invalidateQueries({ queryKey: cleRequeteEchanges })
    },
    onError: (erreur: Error) =>
      notifier({ type: 'erreur', message: fr.echanges.erreur, details: erreur.message }),
  })

  const lignes = (echanges.data ?? []).filter((e) => filtre === 'tous' || e.statut === filtre)

  return (
    <div className="page">
      <header className={styles.entete}>
        <div>
          <h1>{fr.echanges.titre}</h1>
          <p>{fr.echanges.intro}</p>
        </div>
      </header>

      <div className={styles.formulaireInline} style={{ marginBottom: 14 }}>
        {(['a_traiter', 'honore', 'annule', 'tous'] as const).map((valeur) => (
          <button
            key={valeur}
            type="button"
            className={`bouton ${filtre === valeur ? 'bouton-principal' : 'bouton-secondaire'}`}
            aria-pressed={filtre === valeur}
            onClick={() => setFiltre(valeur)}
          >
            {valeur === 'tous' ? fr.echanges.tous : fr.echanges.statuts[valeur]}
          </button>
        ))}
      </div>

      {echanges.isPending ? (
        <p className="etat" role="status">
          {fr.commun.chargement}
        </p>
      ) : echanges.isError ? (
        <div className="etat etat-erreur" role="alert">
          <p>{fr.echanges.erreurChargement}</p>
          <p className="mono">{echanges.error.message}</p>
          <button
            type="button"
            className="bouton bouton-secondaire"
            onClick={() => void echanges.refetch()}
          >
            {fr.commun.reessayer}
          </button>
        </div>
      ) : lignes.length === 0 ? (
        <p className="etat">{fr.echanges.vide}</p>
      ) : (
        <div className={`carte ${styles.liste}`}>
          {lignes.map((e) => (
            <div key={e.id} className={styles.ligne}>
              <span className={styles.ordre}>{fr.recompenses.cout(e.cout_points)}</span>
              <div>
                <span className={styles.titre}>{e.titre}</span>
                <p className={styles.detail}>
                  {fr.echanges.par(e.prenom ?? fr.echanges.sansPrenom)} · {formaterDate(e.cree_le)}
                  <span className="mono"> · {e.utilisateur_id}</span>
                  {e.note ? ` · ${e.note}` : ''}
                </p>
              </div>
              <div className={styles.badges}>
                <span
                  className={
                    e.statut === 'honore'
                      ? styles.badgeValide
                      : e.statut === 'annule'
                        ? styles.badgeInactif
                        : styles.badge
                  }
                >
                  {fr.echanges.statuts[e.statut]}
                </span>
              </div>
              <div className={styles.actions}>
                {e.statut !== 'honore' ? (
                  <button
                    type="button"
                    className="bouton bouton-secondaire"
                    disabled={traitement.isPending}
                    onClick={() => traitement.mutate({ id: e.id, statut: 'honore' })}
                  >
                    {fr.echanges.honorer}
                  </button>
                ) : null}
                {e.statut !== 'annule' ? (
                  <button
                    type="button"
                    className="bouton bouton-discret"
                    disabled={traitement.isPending}
                    onClick={() => setAnnulation(e)}
                  >
                    {fr.echanges.annuler}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <DialogueConfirmation
        ouvert={annulation !== null}
        titre={fr.echanges.annulerTitre}
        message={
          annulation ? fr.echanges.annulerMessage(annulation.titre, annulation.cout_points) : ''
        }
        libelleConfirmer={fr.echanges.annuler}
        libelleAnnuler={fr.commun.annuler}
        onConfirmer={() => {
          if (annulation) traitement.mutate({ id: annulation.id, statut: 'annule' })
          setAnnulation(null)
        }}
        onAnnuler={() => setAnnulation(null)}
      />
    </div>
  )
}
