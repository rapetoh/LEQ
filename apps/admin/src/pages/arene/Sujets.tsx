import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { SujetArene, SujetAreneEditable } from '@leq/domaine'
import { Interrupteur } from '../../composants/Interrupteur'
import { BarreOutils, Echec, Squelette, Vide } from '../../composants/Etats'
import { DialogueEdition } from '../../composants/DialogueEdition'
import { useRecherche } from '../../composants/useRecherche'
import { useNotifier } from '../../composants/toastContext'
import { fr } from '../../fr'
import type { Erreurs } from '../../modele/defis'
import {
  etatSujet,
  prochainOrdreSujet,
  saisieDepuisSujet,
  saisieSujetVierge,
  validerSujet,
  type EtatSujet,
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
  const enEdition = (sujets.data ?? []).find((sujet) => sujet.id === edition) ?? null
  const filtre = useRecherche(sujets.data, (s) => [s.texte, s.cle, s.consigne])
  const [etatFiltre, setEtatFiltre] = useState<EtatSujet | 'tous'>('tous')
  // A closed week sinks: Rebecca opens this page to see what is running and what comes next, not
  // to scroll past everything that is over.
  const rangDe = (sujet: SujetArene): number => {
    const etat = etatSujet(sujet)
    return etat === 'en_cours' ? 0 : etat === 'a_venir' ? 1 : etat === 'inactif' ? 2 : 3
  }
  const liste = [...filtre.resultats]
    .filter((sujet) => etatFiltre === 'tous' || etatSujet(sujet) === etatFiltre)
    .sort((a, b) => {
      const rang = rangDe(a) - rangDe(b)
      if (rang !== 0) return rang
      if (a.prevu_le && b.prevu_le && a.prevu_le !== b.prevu_le) {
        return a.prevu_le < b.prevu_le ? -1 : 1
      }
      return a.ordre - b.ordre
    })

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

      <BarreOutils
        recherche={filtre.recherche}
        onRecherche={filtre.setRecherche}
        placeholder={fr.etats.rechercher}
        compte={fr.etats.resultats(liste.length)}
      >
        {/* Twenty subjects written in one sitting need a way to see only what is coming. */}
        <label className={styles.filtreEtat}>
          <span className="etiquette">{fr.sujets.filtreEtat}</span>
          <select
            className="champ"
            value={etatFiltre}
            onChange={(e) => setEtatFiltre(e.target.value as EtatSujet | 'tous')}
          >
            <option value="tous">{fr.sujets.filtreTous}</option>
            <option value="en_cours">{fr.sujets.etats.en_cours}</option>
            <option value="a_venir">{fr.sujets.etats.a_venir}</option>
            <option value="passe">{fr.sujets.etats.passe}</option>
            <option value="inactif">{fr.sujets.etats.inactif}</option>
          </select>
        </label>
      </BarreOutils>

      {sujets.isPending ? (
        <Squelette lignes={4} />
      ) : sujets.isError ? (
        <Echec titre={fr.sujets.erreurChargement} detail={sujets.error.message} />
      ) : sujets.data.length === 0 ? (
        <Vide marque="◎" titre={fr.sujets.vide} />
      ) : liste.length === 0 ? (
        <Vide marque="⌕" titre={fr.etats.aucunResultat} texte={fr.etats.aucunResultatTexte} />
      ) : (
        <div className={`carte ${styles.liste}`}>
          {liste.map((sujet) => (
            <Ligne key={sujet.id} sujet={sujet} onModifier={() => setEdition(sujet.id)} />
          ))}
        </div>
      )}

      <DialogueEdition
        ouvert={edition !== null}
        titre={edition === 'nouveau' ? fr.sujets.creer : fr.sujets.modifierTitre}
        onFermer={() => setEdition(null)}
      >
        {edition === 'nouveau' ? (
          <FormulaireSujet
            initiale={saisieSujetVierge(prochainOrdreSujet(sujets.data ?? []))}
            creation
            enregistrement={enregistrement}
            onEnregistrer={(valeur) => creation.mutate(valeur)}
            onAnnuler={() => setEdition(null)}
          />
        ) : enEdition ? (
          <FormulaireSujet
            initiale={saisieDepuisSujet(enEdition)}
            creation={false}
            enregistrement={enregistrement}
            onEnregistrer={(valeur) => modification.mutate({ id: enEdition.id, valeur })}
            onAnnuler={() => setEdition(null)}
          />
        ) : null}
      </DialogueEdition>
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
          {!sujet.actif_le && sujet.prevu_le ? ` · ${fr.sujets.prevuLe(sujet.prevu_le)}` : ''}
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
        {/* A dated subject goes first the day it comes. The rest keep following the order, so
            nothing has to be dated for the Arena to run. */}
        <Champ id={`${id}-prevu`} libelle={s.prevu} aide={s.prevuAide} erreur={erreur('prevu_le')}>
          <input
            id={`${id}-prevu`}
            type="date"
            className="champ"
            value={saisie.prevu_le}
            onChange={(e) => changer('prevu_le', e.target.value)}
            aria-invalid={erreurs.prevu_le ? 'true' : undefined}
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
