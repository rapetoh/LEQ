import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { CODES_REGION, NOMS_REGION, type AtelierEditable, type CodeRegion } from '@leq/domaine'
import { useSession } from '../../auth/sessionContext'
import { Interrupteur } from '../../composants/Interrupteur'
import { useNotifier } from '../../composants/toastContext'
import { fr } from '../../fr'
import {
  chargerAteliers,
  cleRequeteAteliers,
  creerAtelier,
  modifierAtelier,
} from '../../services/annonces'
import { chargerRecompenses, cleRequeteRecompenses } from '../../services/recompenses'
import { depuis, validerAtelier, vierge, type SaisieAtelier as Saisie } from '../../modele/ateliers'
import { Champ, Nombre } from '../banques/FormulaireDefi'
import styles from '../banques/Banques.module.css'

function formaterDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

export function Ateliers() {
  const { session } = useSession()
  const notifier = useNotifier()
  const clientRequetes = useQueryClient()
  const ateliers = useQuery({ queryKey: cleRequeteAteliers, queryFn: chargerAteliers })
  const recompenses = useQuery({ queryKey: cleRequeteRecompenses, queryFn: chargerRecompenses })
  const [edition, setEdition] = useState<string | null>(null)
  const invalider = () => clientRequetes.invalidateQueries({ queryKey: cleRequeteAteliers })
  const creation = useMutation({
    mutationFn: (valeur: AtelierEditable) => creerAtelier(valeur, session?.user.id ?? ''),
    onSuccess: () => {
      notifier({ type: 'succes', message: fr.ateliers.cree })
      setEdition(null)
      return invalider()
    },
    onError: (e: Error) =>
      notifier({ type: 'erreur', message: fr.ateliers.erreur, details: e.message }),
  })
  const modification = useMutation({
    mutationFn: ({ id, valeur }: { id: string; valeur: Partial<AtelierEditable> }) =>
      modifierAtelier(id, valeur),
    onSuccess: () => {
      notifier({ type: 'succes', message: fr.ateliers.enregistre })
      setEdition(null)
      return invalider()
    },
    onError: (e: Error) =>
      notifier({ type: 'erreur', message: fr.ateliers.erreur, details: e.message }),
  })
  const enregistrement = creation.isPending || modification.isPending

  return (
    <div className="page">
      <header className={styles.entete}>
        <div>
          <h1>{fr.ateliers.titre}</h1>
          <p>{fr.ateliers.intro}</p>
        </div>
        <button
          type="button"
          className="bouton bouton-principal"
          disabled={edition === 'nouveau'}
          onClick={() => setEdition('nouveau')}
        >
          {fr.ateliers.creer}
        </button>
      </header>
      {edition === 'nouveau' ? (
        <div style={{ marginBottom: 20 }}>
          <FormulaireAtelier
            initiale={vierge()}
            recompenses={recompenses.data ?? []}
            enregistrement={enregistrement}
            onEnregistrer={(v) => creation.mutate(v)}
            onAnnuler={() => setEdition(null)}
          />
        </div>
      ) : null}
      {ateliers.isPending ? (
        <p className="etat" role="status">
          {fr.commun.chargement}
        </p>
      ) : ateliers.isError ? (
        <div className="etat etat-erreur" role="alert">
          <p>{fr.ateliers.erreurChargement}</p>
          <p className="mono">{ateliers.error.message}</p>
        </div>
      ) : ateliers.data.length === 0 ? (
        <p className="etat">{fr.ateliers.vide}</p>
      ) : (
        <div className={`carte ${styles.liste}`}>
          {ateliers.data.map((a) =>
            edition === a.id ? (
              <div key={a.id} style={{ padding: 4 }}>
                <FormulaireAtelier
                  initiale={depuis(a)}
                  recompenses={recompenses.data ?? []}
                  enregistrement={enregistrement}
                  onEnregistrer={(v) => modification.mutate({ id: a.id, valeur: v })}
                  onAnnuler={() => setEdition(null)}
                />
              </div>
            ) : (
              <div key={a.id} className={`${styles.ligne} ${a.publie ? '' : styles.ligneInactive}`}>
                <span className={styles.ordre}>{a.places ?? '·'}</span>
                <div>
                  <span className={styles.titre}>{a.titre}</span>
                  <p className={styles.detail}>
                    {formaterDate(a.date_debut)} · {a.en_ligne ? fr.ateliers.enLigne : a.lieu}
                    {a.region ? ` · ${NOMS_REGION[a.region]}` : ''}
                    {a.sous_titre ? ` · ${a.sous_titre}` : ''}
                  </p>
                </div>
                <div className={styles.badges}>
                  <span className={a.publie ? styles.badgeValide : styles.badge}>
                    {a.publie ? fr.ateliers.publie : fr.ateliers.brouillon}
                  </span>
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className="bouton bouton-secondaire"
                    onClick={() => setEdition(a.id)}
                  >
                    {fr.ateliers.modifier}
                  </button>
                  <button
                    type="button"
                    className="bouton bouton-discret"
                    disabled={enregistrement}
                    onClick={() => modification.mutate({ id: a.id, valeur: { publie: !a.publie } })}
                  >
                    {a.publie ? fr.ateliers.depublier : fr.ateliers.publier}
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  )
}

function FormulaireAtelier({
  initiale,
  recompenses,
  enregistrement,
  onEnregistrer,
  onAnnuler,
}: {
  initiale: Saisie
  recompenses: ReadonlyArray<{ id: string; titre: string }>
  enregistrement: boolean
  onEnregistrer: (valeur: AtelierEditable) => void
  onAnnuler: () => void
}) {
  const id = useId()
  const [s, setS] = useState<Saisie>(initiale)
  const [erreurs, setErreurs] = useState<Record<string, string>>({})
  const c = fr.ateliers.champs
  const maj = <K extends keyof Saisie>(k: K, v: Saisie[K]) => {
    setS((courante) => ({ ...courante, [k]: v }))
    setErreurs({})
  }
  return (
    <form
      className={`carte ${styles.formulaire}`}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        const r = validerAtelier(s)
        if (!r.ok) {
          setErreurs(r.erreurs)
          return
        }
        onEnregistrer(r.valeur)
      }}
    >
      <div className={styles.grilleChamps}>
        <Champ id={`${id}-titre`} libelle={c.titre} erreur={erreurs.titre ?? null}>
          <input
            id={`${id}-titre`}
            className="champ"
            value={s.titre}
            onChange={(e) => maj('titre', e.target.value)}
            aria-invalid={erreurs.titre ? 'true' : undefined}
          />
        </Champ>
        <Champ id={`${id}-sous-titre`} libelle={c.sousTitre}>
          <input
            id={`${id}-sous-titre`}
            className="champ"
            value={s.sous_titre}
            onChange={(e) => maj('sous_titre', e.target.value)}
          />
        </Champ>
        <Champ id={`${id}-date`} libelle={c.date} erreur={erreurs.date_debut ?? null}>
          <input
            id={`${id}-date`}
            type="datetime-local"
            className="champ"
            value={s.date_debut}
            onChange={(e) => maj('date_debut', e.target.value)}
            aria-invalid={erreurs.date_debut ? 'true' : undefined}
          />
        </Champ>
      </div>
      <Champ id={`${id}-description`} libelle={c.description} aide={c.descriptionAide}>
        <textarea
          id={`${id}-description`}
          className="champ"
          rows={2}
          value={s.description}
          onChange={(e) => maj('description', e.target.value)}
        />
      </Champ>
      <div className={styles.interrupteurLigne}>
        <Interrupteur
          id={`${id}-en-ligne`}
          actif={s.en_ligne}
          libelle={c.enLigne}
          onChange={(v) => maj('en_ligne', v)}
        />
        <div>
          <label htmlFor={`${id}-en-ligne`} className="etiquette" style={{ marginBottom: 0 }}>
            {c.enLigne}
          </label>
          <p className={styles.aide}>{c.enLigneAide}</p>
        </div>
      </div>
      <div className={styles.grilleChamps}>
        <Champ id={`${id}-lieu`} libelle={c.lieu} aide={c.lieuAide} erreur={erreurs.lieu ?? null}>
          <input
            id={`${id}-lieu`}
            className="champ"
            value={s.lieu}
            onChange={(e) => maj('lieu', e.target.value)}
            aria-invalid={erreurs.lieu ? 'true' : undefined}
          />
        </Champ>
        {!s.en_ligne ? (
          <Champ id={`${id}-region`} libelle={c.region} aide={c.regionAide}>
            <select
              id={`${id}-region`}
              className="champ"
              value={s.region}
              onChange={(e) => maj('region', e.target.value as CodeRegion | '')}
            >
              <option value="">{c.sansRegion}</option>
              {CODES_REGION.map((code) => (
                <option key={code} value={code}>
                  {NOMS_REGION[code]}
                </option>
              ))}
            </select>
          </Champ>
        ) : null}
        <Champ id={`${id}-places`} libelle={c.places} erreur={erreurs.places ?? null}>
          <Nombre
            id={`${id}-places`}
            valeur={s.places}
            invalide={Boolean(erreurs.places)}
            onChange={(v) => maj('places', v)}
          />
        </Champ>
      </div>
      <div className={styles.grilleChamps}>
        <Champ id={`${id}-lien`} libelle={c.lien} aide={c.lienAide}>
          <input
            id={`${id}-lien`}
            className="champ champ-mono"
            value={s.lien}
            onChange={(e) => maj('lien', e.target.value)}
          />
        </Champ>
        <Champ id={`${id}-recompense`} libelle={c.recompense} aide={c.recompenseAide}>
          <select
            id={`${id}-recompense`}
            className="champ"
            value={s.recompense_id}
            onChange={(e) => maj('recompense_id', e.target.value)}
          >
            <option value="">{c.sansRecompense}</option>
            {recompenses.map((r) => (
              <option key={r.id} value={r.id}>
                {r.titre}
              </option>
            ))}
          </select>
        </Champ>
      </div>
      <div className={styles.interrupteurLigne}>
        <Interrupteur
          id={`${id}-publie`}
          actif={s.publie}
          libelle={c.publie}
          onChange={(v) => maj('publie', v)}
        />
        <div>
          <label htmlFor={`${id}-publie`} className="etiquette" style={{ marginBottom: 0 }}>
            {c.publie}
          </label>
          <p className={styles.aide}>{c.publieAide}</p>
        </div>
      </div>
      <div className={styles.piedFormulaire}>
        <div>
          <button type="submit" className="bouton bouton-principal" disabled={enregistrement}>
            {fr.commun.enregistrer}
          </button>
          <button type="button" className="bouton bouton-discret" onClick={onAnnuler}>
            {fr.commun.annuler}
          </button>
        </div>
      </div>
    </form>
  )
}
