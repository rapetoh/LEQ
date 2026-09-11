import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { SujetArene, SujetAreneEditable } from '@leq/domaine'
import { Interrupteur } from '../../composants/Interrupteur'
import { useNotifier } from '../../composants/toastContext'
import { fr } from '../../fr'
import type { Erreurs } from '../../modele/defis'
import {
  etatSujet,
  prochainOrdreSujet,
  saisieDepuisSujet,
  saisieSujetVierge,
  validerSujet,
  type SaisieSujet,
} from '../../modele/sujets'
import { chargerSujets, cleRequeteSujets, creerSujet, modifierSujet } from '../../services/arene'
import { Champ, Nombre } from '../banques/FormulaireDefi'
import styles from '../banques/Banques.module.css'

function formaterDate(iso: string | null): string {
  return iso ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(iso)) : ''
}

/** The bank of Arena subjects, in the order they will run. One a week, by the rotation job. */
export function Sujets() {
  const notifier = useNotifier()
  const clientRequetes = useQueryClient()
  const sujets = useQuery({ queryKey: cleRequeteSujets, queryFn: chargerSujets })
  const [edition, setEdition] = useState<string | null>(null)

  const invalider = () => clientRequetes.invalidateQueries({ queryKey: cleRequeteSujets })
  const messageErreur = (erreur: Error) =>
    /duplicate|unique|23505/i.test(erreur.message) ? fr.sujets.erreurDoublon : fr.sujets.erreur

  const creation = useMutation({
    mutationFn: creerSujet,
    onSuccess: () => {
      void invalider()
      notifier({ type: 'succes', message: fr.sujets.cree })
      setEdition(null)
    },
    onError: (erreur: Error) =>
      notifier({ type: 'erreur', message: messageErreur(erreur), details: erreur.message }),
  })
  const modification = useMutation({
    mutationFn: modifierSujet,
    onSuccess: () => {
      void invalider()
      notifier({ type: 'succes', message: fr.sujets.enregistre })
      setEdition(null)
    },
    onError: (erreur: Error) =>
      notifier({ type: 'erreur', message: messageErreur(erreur), details: erreur.message }),
  })
  const enregistrement = creation.isPending || modification.isPending

  return (
    <div className="page">
      <header className={styles.entete}>
        <div>
          <h1>{fr.sujets.titre}</h1>
          <p>{fr.sujets.intro}</p>
        </div>
        <button
          type="button"
          className="bouton bouton-principal"
          disabled={edition === 'nouveau'}
          onClick={() => setEdition('nouveau')}
        >
          {fr.sujets.creer}
        </button>
      </header>

      {edition === 'nouveau' ? (
        <div style={{ marginBottom: 20 }}>
          <FormulaireSujet
            initiale={saisieSujetVierge(prochainOrdreSujet(sujets.data ?? []))}
            creation
            enregistrement={enregistrement}
            onEnregistrer={(valeur) => creation.mutate(valeur)}
            onAnnuler={() => setEdition(null)}
          />
        </div>
      ) : null}

      {sujets.isPending ? (
        <p className="etat" role="status">
          {fr.commun.chargement}
        </p>
      ) : sujets.isError ? (
        <div className="etat etat-erreur" role="alert">
          <p>{fr.sujets.erreurChargement}</p>
          <p className="mono">{sujets.error.message}</p>
        </div>
      ) : sujets.data.length === 0 ? (
        <p className="etat">{fr.sujets.vide}</p>
      ) : (
        <div className={`carte ${styles.liste}`}>
          {sujets.data.map((sujet) =>
            edition === sujet.id ? (
              <div key={sujet.id} style={{ padding: 4 }}>
                <FormulaireSujet
                  initiale={saisieDepuisSujet(sujet)}
                  creation={false}
                  enregistrement={enregistrement}
                  onEnregistrer={(valeur) => modification.mutate({ id: sujet.id, valeur })}
                  onAnnuler={() => setEdition(null)}
                />
              </div>
            ) : (
              <Ligne key={sujet.id} sujet={sujet} onModifier={() => setEdition(sujet.id)} />
            ),
          )}
        </div>
      )}
    </div>
  )
}

function Ligne({ sujet, onModifier }: { sujet: SujetArene; onModifier: () => void }) {
  const etat = etatSujet(sujet)
  const badge =
    etat === 'en_cours'
      ? styles.badgeValide
      : etat === 'passe' || etat === 'inactif'
        ? styles.badgeInactif
        : styles.badge
  return (
    <div className={`${styles.ligne} ${sujet.actif ? '' : styles.ligneInactive}`}>
      <span className={styles.ordre}>{sujet.ordre}</span>
      <div>
        <span className={styles.titre}>{sujet.texte}</span>
        <p className={styles.detail}>
          <span className="mono">{sujet.cle}</span> · {fr.sujets.duree(sujet.duree_max_s)}
          {sujet.actif_le ? ` · ${fr.sujets.actifDepuis(formaterDate(sujet.actif_le))}` : ''}
          {sujet.consigne ? ` · ${sujet.consigne}` : ''}
        </p>
      </div>
      <div className={styles.badges}>
        <span className={badge}>{fr.sujets.etats[etat]}</span>
        {sujet.provisoire ? (
          <span className={styles.badge}>{fr.banques.badges.provisoire}</span>
        ) : null}
      </div>
      <div className={styles.actions}>
        <button type="button" className="bouton bouton-secondaire" onClick={onModifier}>
          {fr.sujets.modifier}
        </button>
      </div>
    </div>
  )
}

function FormulaireSujet({
  initiale,
  creation,
  enregistrement,
  onEnregistrer,
  onAnnuler,
}: {
  initiale: SaisieSujet
  creation: boolean
  enregistrement: boolean
  onEnregistrer: (valeur: SujetAreneEditable) => void
  onAnnuler: () => void
}) {
  const id = useId()
  const [saisie, setSaisie] = useState<SaisieSujet>(initiale)
  const [erreurs, setErreurs] = useState<Erreurs>({})
  const c = fr.banques.champs
  const s = fr.sujets.champs
  const changer = <K extends keyof SaisieSujet>(champ: K, valeur: SaisieSujet[K]) => {
    setSaisie((courante) => ({ ...courante, [champ]: valeur }))
    setErreurs((courantes) => {
      const reste = { ...courantes }
      delete reste[champ]
      return reste
    })
  }
  const erreur = (champ: string) => {
    const code = erreurs[champ]
    return code ? fr.banques.erreurs[code] : null
  }

  return (
    <form
      className={`carte ${styles.formulaire}`}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        const resultat = validerSujet(saisie)
        if (!resultat.ok) {
          setErreurs(resultat.erreurs)
          return
        }
        onEnregistrer(resultat.valeur)
      }}
    >
      <div className={styles.grilleChamps}>
        <Champ id={`${id}-cle`} libelle={c.cle} aide={c.cleAide} erreur={erreur('cle')}>
          <input
            id={`${id}-cle`}
            className="champ champ-mono"
            value={saisie.cle}
            disabled={!creation}
            onChange={(e) => changer('cle', e.target.value)}
            aria-invalid={erreurs.cle ? 'true' : undefined}
          />
        </Champ>
        <Champ id={`${id}-ordre`} libelle={s.ordre} aide={s.ordreAide} erreur={erreur('ordre')}>
          <Nombre
            id={`${id}-ordre`}
            valeur={saisie.ordre}
            invalide={Boolean(erreurs.ordre)}
            onChange={(v) => changer('ordre', v)}
          />
        </Champ>
        <Champ id={`${id}-duree`} libelle={s.duree} erreur={erreur('duree_max_s')}>
          <Nombre
            id={`${id}-duree`}
            valeur={saisie.duree_max_s}
            unite="s"
            invalide={Boolean(erreurs.duree_max_s)}
            onChange={(v) => changer('duree_max_s', v)}
          />
        </Champ>
      </div>
      <Champ id={`${id}-texte`} libelle={s.texte} aide={s.texteAide} erreur={erreur('texte')}>
        <textarea
          id={`${id}-texte`}
          className="champ"
          rows={2}
          value={saisie.texte}
          onChange={(e) => changer('texte', e.target.value)}
          aria-invalid={erreurs.texte ? 'true' : undefined}
        />
      </Champ>
      <Champ id={`${id}-consigne`} libelle={s.consigne} aide={s.consigneAide}>
        <input
          id={`${id}-consigne`}
          className="champ"
          value={saisie.consigne}
          onChange={(e) => changer('consigne', e.target.value)}
        />
      </Champ>
      <div className={styles.interrupteurLigne}>
        <Interrupteur
          id={`${id}-provisoire`}
          actif={saisie.provisoire}
          libelle={c.provisoire}
          onChange={(v) => changer('provisoire', v)}
        />
        <div>
          <label htmlFor={`${id}-provisoire`} className="etiquette" style={{ marginBottom: 0 }}>
            {c.provisoire}
          </label>
          <p className={styles.aide}>{s.provisoireAide}</p>
        </div>
      </div>
      <div className={styles.interrupteurLigne}>
        <Interrupteur
          id={`${id}-actif`}
          actif={saisie.actif}
          libelle={c.actif}
          onChange={(v) => changer('actif', v)}
        />
        <div>
          <label htmlFor={`${id}-actif`} className="etiquette" style={{ marginBottom: 0 }}>
            {c.actif}
          </label>
          <p className={styles.aide}>{s.actifAide}</p>
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
