import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CategorieModeration, StatutPrisePublique } from '@leq/domaine'
import { useEffect, useState } from 'react'
import { useNotifier } from '../../composants/toastContext'
import { fr } from '../../fr'
import {
  chargerModeration,
  cleRequeteModeration,
  lirePriseARelire,
  modererPrise,
  urlAudioPrise,
  type PriseAModerer,
} from '../../services/arene'
import styles from '../banques/Banques.module.css'
import propres from './Moderation.module.css'

function formaterDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

type Filtre = StatutPrisePublique | 'tous'
const FILTRES: readonly Filtre[] = ['signalee', 'publiee', 'retiree', 'tous']

/**
 * The moderation of chapter 11, as the cahier actually describes it: takes are live on send, the
 * screening holds the ones it flagged, and Rebecca withdraws what has no place here. Sexual
 * content, harassment of real people and what is illegal go; politics, religion and ethics stay.
 * She listens, reads the transcript and the reason the filter gave, then decides; the person is
 * told either way.
 */
export function Moderation() {
  const notifier = useNotifier()
  const clientRequetes = useQueryClient()
  const prises = useQuery({ queryKey: cleRequeteModeration, queryFn: chargerModeration })
  const [filtre, setFiltre] = useState<Filtre>('signalee')
  const [ouverte, setOuverte] = useState<string | null>(null)
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
        {FILTRES.map((valeur) => (
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
            <div key={prise.id} className={propres.bloc}>
              <div
                className={`${styles.ligne} ${prise.statut === 'retiree' ? styles.ligneInactive : ''}`}
              >
                <span className={styles.ordre}>{formaterDate(prise.cree_le)}</span>
                <div>
                  <span className={styles.titre}>{prise.sujet ?? fr.moderation.sansSujet}</span>
                  <p className={styles.detail}>
                    {fr.moderation.contextes[prise.contexte]}
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
                  <button
                    type="button"
                    className="bouton bouton-secondaire"
                    aria-expanded={ouverte === prise.id}
                    onClick={() => setOuverte(ouverte === prise.id ? null : prise.id)}
                  >
                    {ouverte === prise.id ? fr.commun.fermer : fr.moderation.relire}
                  </button>
                  {prise.statut !== 'publiee' && !prise.audio_supprime_le ? (
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
              {ouverte === prise.id ? <Relecture prise={prise} /> : null}
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
    </div>
  )
}

/**
 * What Rebecca reviews: the audio of that take, the reason the filter gave, and the transcript.
 * Loaded only when she opens the row: a signed URL and a transcript are read for one take at a
 * time, never for the whole list.
 */
function Relecture({ prise }: { prise: PriseAModerer }) {
  const lecture = useQuery({
    queryKey: ['prise_a_relire', prise.id],
    queryFn: () => lirePriseARelire(prise.id),
  })
  const [url, setUrl] = useState<string | null>(null)
  const [erreurAudio, setErreurAudio] = useState<string | null>(null)

  useEffect(() => {
    let vivant = true
    if (!prise.chemin_audio || prise.audio_supprime_le) return
    urlAudioPrise(prise.chemin_audio)
      .then((u) => {
        if (vivant) setUrl(u)
      })
      .catch((erreur: Error) => {
        if (vivant) setErreurAudio(erreur.message)
      })
    return () => {
      vivant = false
    }
  }, [prise.chemin_audio, prise.audio_supprime_le])

  const verdict = lecture.data?.moderation ?? null
  return (
    <div className={propres.relecture}>
      <div className={propres.colonne}>
        <span className="etiquette">{fr.moderation.ecouter}</span>
        {!prise.chemin_audio || prise.audio_supprime_le ? (
          <p className={styles.detail}>{fr.moderation.audioSupprime}</p>
        ) : url ? (
          <audio controls preload="metadata" src={url} className={propres.lecteur} />
        ) : erreurAudio ? (
          <p className={`${styles.detail} mono`}>{erreurAudio}</p>
        ) : (
          <p className={styles.detail}>{fr.commun.chargement}</p>
        )}

        <span className="etiquette">{fr.moderation.filtre}</span>
        {lecture.isPending ? (
          <p className={styles.detail}>{fr.commun.chargement}</p>
        ) : verdict === null ? (
          <p className={styles.detail}>{fr.moderation.nonFiltree}</p>
        ) : verdict.signalee ? (
          <ul className={propres.motifs}>
            {verdict.categories.map((categorie: CategorieModeration) => (
              <li key={categorie} className={styles.badge}>
                {fr.moderation.motifs[categorie]}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.detail}>{fr.moderation.filtreRas}</p>
        )}
      </div>

      <div className={propres.colonne}>
        <span className="etiquette">
          {fr.moderation.transcription}
          {lecture.data?.prenom ? ` · ${lecture.data.prenom}` : ''}
        </span>
        {lecture.isPending ? (
          <p className={styles.detail}>{fr.commun.chargement}</p>
        ) : lecture.isError ? (
          <p className={`${styles.detail} mono`}>{lecture.error.message}</p>
        ) : lecture.data.texte && lecture.data.texte.trim() !== '' ? (
          <p className={propres.transcription}>{lecture.data.texte}</p>
        ) : (
          <p className={styles.detail}>{fr.moderation.transcriptionVide}</p>
        )}
      </div>
    </div>
  )
}
