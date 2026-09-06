import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { NOMS_REGION, type Profil } from '@leq/domaine'
import { DialogueConfirmation } from '../../composants/Dialogue'
import { useNotifier } from '../../composants/toastContext'
import { fr } from '../../fr'
import {
  chargerProfils,
  chargerSuspensions,
  cleRequeteProfils,
  cleRequeteSuspensions,
  reactiverCompte,
  suspendreCompte,
} from '../../services/utilisateurs'
import styles from '../banques/Banques.module.css'

function formaterDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(iso))
}

/** Profiles as the admin sees them: no e-mail (it lives in auth), a first name when given, the region, the role, the state. */
export function Utilisateurs() {
  const id = useId()
  const notifier = useNotifier()
  const clientRequetes = useQueryClient()
  const profils = useQuery({ queryKey: cleRequeteProfils, queryFn: chargerProfils })
  const suspensions = useQuery({ queryKey: cleRequeteSuspensions, queryFn: chargerSuspensions })
  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState<'tous' | 'suspendus' | 'admins'>('tous')
  const [aSuspendre, setASuspendre] = useState<Profil | null>(null)
  const [motif, setMotif] = useState('')

  const invalider = () => {
    void clientRequetes.invalidateQueries({ queryKey: cleRequeteSuspensions })
    return clientRequetes.invalidateQueries({ queryKey: cleRequeteProfils })
  }
  const suspension = useMutation({
    mutationFn: ({ uid, motif }: { uid: string; motif: string }) => suspendreCompte(uid, motif),
    onSuccess: () => {
      notifier({ type: 'succes', message: fr.utilisateurs.suspendu })
      setMotif('')
      return invalider()
    },
    onError: (e: Error) =>
      notifier({ type: 'erreur', message: fr.utilisateurs.erreur, details: e.message }),
  })
  const reactivation = useMutation({
    mutationFn: reactiverCompte,
    onSuccess: () => {
      notifier({ type: 'succes', message: fr.utilisateurs.reactive })
      return invalider()
    },
    onError: (e: Error) =>
      notifier({ type: 'erreur', message: fr.utilisateurs.erreur, details: e.message }),
  })

  const motifsOuverts = new Map(
    (suspensions.data ?? [])
      .filter((s) => s.levee_le === null)
      .map((s) => [s.utilisateur_id, s.motif]),
  )
  const terme = recherche.trim().toLowerCase()
  const lignes = (profils.data ?? []).filter((p) => {
    if (filtre === 'suspendus' && p.suspendu_le === null) return false
    if (filtre === 'admins' && p.role !== 'admin') return false
    if (terme === '') return true
    return (p.prenom ?? '').toLowerCase().includes(terme) || p.id.startsWith(terme)
  })

  return (
    <div className="page">
      <header className={styles.entete}>
        <div>
          <h1>{fr.utilisateurs.titre}</h1>
          <p>{fr.utilisateurs.intro}</p>
        </div>
        <span className={styles.compte}>{fr.utilisateurs.nombre(profils.data?.length ?? 0)}</span>
      </header>

      <div className={styles.formulaireInline} style={{ marginBottom: 14 }}>
        <input
          className="champ"
          aria-label={fr.utilisateurs.rechercher}
          placeholder={fr.utilisateurs.rechercher}
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        {(['tous', 'suspendus', 'admins'] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={`bouton ${filtre === f ? 'bouton-principal' : 'bouton-secondaire'}`}
            aria-pressed={filtre === f}
            onClick={() => setFiltre(f)}
          >
            {fr.utilisateurs.filtres[f]}
          </button>
        ))}
      </div>

      {profils.isPending ? (
        <p className="etat" role="status">
          {fr.commun.chargement}
        </p>
      ) : profils.isError ? (
        <div className="etat etat-erreur" role="alert">
          <p>{fr.utilisateurs.erreurChargement}</p>
          <p className="mono">{profils.error.message}</p>
        </div>
      ) : lignes.length === 0 ? (
        <p className="etat">{fr.utilisateurs.vide}</p>
      ) : (
        <div className={`carte ${styles.liste}`}>
          {lignes.map((p) => (
            <div
              key={p.id}
              className={`${styles.ligne} ${p.suspendu_le ? styles.ligneInactive : ''}`}
            >
              <span className={styles.ordre}>{p.role === 'admin' ? 'A' : '·'}</span>
              <div>
                <span className={styles.titre}>{p.prenom ?? fr.utilisateurs.sansPrenom}</span>
                <p className={styles.detail}>
                  <span className="mono">{p.id}</span> ·{' '}
                  {fr.utilisateurs.depuis(formaterDate(p.cree_le))}
                  {p.region ? ` · ${NOMS_REGION[p.region]}` : ''}
                  {p.suspendu_le
                    ? ` · ${fr.utilisateurs.suspenduDepuis(formaterDate(p.suspendu_le))}`
                    : ''}
                  {motifsOuverts.get(p.id) ? ` · ${motifsOuverts.get(p.id)}` : ''}
                </p>
              </div>
              <div className={styles.badges}>
                {p.role === 'admin' ? (
                  <span className={styles.badgeValide}>{fr.utilisateurs.admin}</span>
                ) : null}
                {p.suspendu_le ? (
                  <span className={styles.badgeInactif}>{fr.utilisateurs.filtres.suspendus}</span>
                ) : null}
              </div>
              <div className={styles.actions}>
                {p.role === 'admin' ? null : p.suspendu_le ? (
                  <button
                    type="button"
                    className="bouton bouton-secondaire"
                    disabled={reactivation.isPending}
                    onClick={() => reactivation.mutate(p.id)}
                  >
                    {fr.utilisateurs.reactiver}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="bouton bouton-discret"
                    onClick={() => setASuspendre(p)}
                  >
                    {fr.utilisateurs.suspendre}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {aSuspendre ? (
        <div
          className={`carte ${styles.formulaire}`}
          style={{ marginTop: 16 }}
          role="dialog"
          aria-labelledby={`${id}-titre`}
        >
          <h2 id={`${id}-titre`}>
            {fr.utilisateurs.suspendreTitre(aSuspendre.prenom ?? fr.utilisateurs.sansPrenom)}
          </h2>
          <p className={styles.aide}>{fr.utilisateurs.suspendreMessage}</p>
          <label htmlFor={`${id}-motif`} className="etiquette">
            {fr.utilisateurs.motif}
          </label>
          <textarea
            id={`${id}-motif`}
            className="champ"
            rows={2}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
          />
          <div className={styles.piedFormulaire}>
            <div>
              <button
                type="button"
                className="bouton bouton-principal"
                disabled={motif.trim() === '' || suspension.isPending}
                onClick={() => {
                  suspension.mutate({ uid: aSuspendre.id, motif: motif.trim() })
                  setASuspendre(null)
                }}
              >
                {fr.utilisateurs.suspendre}
              </button>
              <button
                type="button"
                className="bouton bouton-discret"
                onClick={() => setASuspendre(null)}
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
