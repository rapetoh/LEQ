import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { DialogueConfirmation } from '../../composants/Dialogue'
import { useNotifier } from '../../composants/toastContext'
import { fr } from '../../fr'
import {
  chargerModeration,
  cleRequeteModeration,
  modererPrise,
  type PriseAModerer,
} from '../../services/arene'
import styles from '../banques/Banques.module.css'

function formaterDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

/**
 * The moderation queue of chapter 11: block the waste, not the difficult subjects. Sexual
 * content, harassment of real people and what is illegal go; politics, religion and ethics stay.
 */
export function Moderation() {
  const notifier = useNotifier()
  const clientRequetes = useQueryClient()
  const prises = useQuery({ queryKey: cleRequeteModeration, queryFn: chargerModeration })
  const [filtre, setFiltre] = useState<'en_moderation' | 'publiee' | 'retiree' | 'tous'>(
    'en_moderation',
  )
  const [aRetirer, setARetirer] = useState<PriseAModerer | null>(null)
  const [motif, setMotif] = useState('')

  const decision = useMutation({
    mutationFn: ({
      id,
      statut,
      motif,
    }: {
      id: string
      statut: 'publiee' | 'retiree'
      motif?: string
    }) => modererPrise(id, statut, motif),
    onSuccess: () => {
      notifier({ type: 'succes', message: fr.moderation.traite })
      return clientRequetes.invalidateQueries({ queryKey: cleRequeteModeration })
    },
    onError: (erreur: Error) =>
      notifier({ type: 'erreur', message: fr.moderation.erreur, details: erreur.message }),
  })

  const lignes = (prises.data ?? []).filter((p) => filtre === 'tous' || p.statut === filtre)

  return (
    <div className="page">
      <header className={styles.entete}>
        <div>
          <h1>{fr.moderation.titre}</h1>
          <p>{fr.moderation.intro}</p>
        </div>
      </header>

      <div className={styles.formulaireInline} style={{ marginBottom: 14 }}>
        {(['en_moderation', 'publiee', 'retiree', 'tous'] as const).map((valeur) => (
          <button
            key={valeur}
            type="button"
            className={`bouton ${filtre === valeur ? 'bouton-principal' : 'bouton-secondaire'}`}
            aria-pressed={filtre === valeur}
            onClick={() => setFiltre(valeur)}
          >
            {valeur === 'tous' ? fr.moderation.tous : fr.moderation.statuts[valeur]}
          </button>
        ))}
      </div>

      {prises.isPending ? (
        <p className="etat" role="status">
          {fr.commun.chargement}
        </p>
      ) : prises.isError ? (
        <div className="etat etat-erreur" role="alert">
          <p>{fr.moderation.erreurChargement}</p>
          <p className="mono">{prises.error.message}</p>
        </div>
      ) : lignes.length === 0 ? (
        <p className="etat">{fr.moderation.vide}</p>
      ) : (
        <div className={`carte ${styles.liste}`}>
          {lignes.map((prise) => (
            <div
              key={prise.id}
              className={`${styles.ligne} ${prise.statut === 'retiree' ? styles.ligneInactive : ''}`}
            >
              <span className={styles.ordre}>{formaterDate(prise.cree_le)}</span>
              <div>
                <span className={styles.titre}>{prise.sujet ?? fr.moderation.sansSujet}</span>
                <p className={styles.detail}>
                  {fr.moderation.contextes[prise.contexte]} ·{' '}
                  <span className="mono">{prise.utilisateur_id}</span>
                  {prise.motif_retrait ? ` · ${prise.motif_retrait}` : ''}
                  {prise.audio_supprime_le ? ` · ${fr.moderation.audioSupprime}` : ''}
                </p>
              </div>
              <div className={styles.badges}>
                <span
                  className={
                    prise.statut === 'publiee'
                      ? styles.badgeValide
                      : prise.statut === 'retiree'
                        ? styles.badgeInactif
                        : styles.badge
                  }
                >
                  {fr.moderation.statuts[prise.statut]}
                </span>
              </div>
              <div className={styles.actions}>
                {prise.statut !== 'publiee' ? (
                  <button
                    type="button"
                    className="bouton bouton-secondaire"
                    disabled={decision.isPending}
                    onClick={() => decision.mutate({ id: prise.id, statut: 'publiee' })}
                  >
                    {fr.moderation.publier}
                  </button>
                ) : null}
                {prise.statut !== 'retiree' ? (
                  <button
                    type="button"
                    className="bouton bouton-discret"
                    disabled={decision.isPending}
                    onClick={() => setARetirer(prise)}
                  >
                    {fr.moderation.retirer}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {aRetirer ? (
        <div className={`carte ${styles.formulaire}`} style={{ marginTop: 16 }}>
          <h2>{fr.moderation.retirerTitre}</h2>
          <p className={styles.aide}>{fr.moderation.retirerAide}</p>
          <label htmlFor="motif-retrait" className="etiquette">
            {fr.moderation.motif}
          </label>
          <input
            id="motif-retrait"
            className="champ"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
          />
          <div className={styles.piedFormulaire}>
            <div>
              <button
                type="button"
                className="bouton bouton-principal"
                disabled={motif.trim() === '' || decision.isPending}
                // Same as suspension: the reason must not survive a failed write and land on
                // the next take.
                onClick={() => {
                  decision.mutate(
                    { id: aRetirer.id, statut: 'retiree', motif: motif.trim() },
                    {
                      onSuccess: () => {
                        setARetirer(null)
                        setMotif('')
                      },
                    },
                  )
                }}
              >
                {fr.moderation.retirer}
              </button>
              <button
                type="button"
                className="bouton bouton-discret"
                onClick={() => setARetirer(null)}
              >
                {fr.commun.annuler}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <DialogueConfirmation
        ouvert={false}
        titre=""
        message=""
        libelleConfirmer=""
        libelleAnnuler=""
        onConfirmer={() => undefined}
        onAnnuler={() => undefined}
      />
    </div>
  )
}
