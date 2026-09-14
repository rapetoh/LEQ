import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { DialogueEdition } from '../composants/DialogueEdition'
import { Echec, Squelette, Vide } from '../composants/Etats'
import { Interrupteur } from '../composants/Interrupteur'
import { useNotifier } from '../composants/toastContext'
import { fr } from '../fr'
import type { Erreurs } from '../modele/defis'
import {
  cleDepuisNom,
  FORMULE_PAR_DEFAUT,
  prochainOrdreFormule,
  saisieDepuisFormule,
  saisieFormuleVierge,
  validerFormule,
  type FormuleDetail,
  type SaisieFormule,
} from '../modele/formules'
import {
  chargerFormules,
  cleRequeteFormules,
  creerFormule,
  modifierFormule,
} from '../services/formules'
import { Champ, Nombre } from './banques/FormulaireDefi'
import styles from './banques/Banques.module.css'

/** The tiers: what each one gives. A third one is a row here, never a release. */
export function Formules() {
  const notifier = useNotifier()
  const clientRequetes = useQueryClient()
  const formules = useQuery({ queryKey: cleRequeteFormules, queryFn: chargerFormules })
  const [edition, setEdition] = useState<string | null>(null)
  const enEdition = (formules.data ?? []).find((f) => f.cle === edition) ?? null

  const invalider = () => clientRequetes.invalidateQueries({ queryKey: cleRequeteFormules })
  const messageErreur = (erreur: Error) =>
    /duplicate|unique|23505/i.test(erreur.message) ? fr.formules.erreurDoublon : fr.formules.erreur

  const creation = useMutation({
    mutationFn: creerFormule,
    onSuccess: () => {
      void invalider()
      notifier({ type: 'succes', message: fr.formules.creee })
      setEdition(null)
    },
    onError: (erreur: Error) =>
      notifier({ type: 'erreur', message: messageErreur(erreur), details: erreur.message }),
  })
  const modification = useMutation({
    mutationFn: modifierFormule,
    onSuccess: () => {
      void invalider()
      notifier({ type: 'succes', message: fr.formules.enregistree })
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
          <h1>{fr.formules.titre}</h1>
          <p>{fr.formules.intro}</p>
        </div>
        <button
          type="button"
          className="bouton bouton-principal"
          disabled={edition === 'nouvelle'}
          onClick={() => setEdition('nouvelle')}
        >
          {fr.formules.creer}
        </button>
      </header>

      {formules.isPending ? (
        <Squelette lignes={2} />
      ) : formules.isError ? (
        <Echec titre={fr.formules.erreurChargement} detail={formules.error.message} />
      ) : formules.data.length === 0 ? (
        <Vide marque="◆" titre={fr.formules.vide} />
      ) : (
        <div className={`carte ${styles.liste}`}>
          {formules.data.map((formule) => (
            <Ligne key={formule.cle} formule={formule} onModifier={() => setEdition(formule.cle)} />
          ))}
        </div>
      )}

      <DialogueEdition
        ouvert={edition !== null}
        titre={edition === 'nouvelle' ? fr.formules.nouvelle : fr.formules.modifierTitre}
        onFermer={() => setEdition(null)}
      >
        {edition === 'nouvelle' ? (
          <FormulaireFormule
            initiale={saisieFormuleVierge(prochainOrdreFormule(formules.data ?? []))}
            creation
            enregistrement={enregistrement}
            onEnregistrer={(valeur) => creation.mutate(valeur)}
            onAnnuler={() => setEdition(null)}
          />
        ) : enEdition ? (
          <FormulaireFormule
            initiale={saisieDepuisFormule(enEdition)}
            creation={false}
            enregistrement={enregistrement}
            onEnregistrer={({ cle, ...valeur }) => modification.mutate({ cle, valeur })}
            onAnnuler={() => setEdition(null)}
          />
        ) : null}
      </DialogueEdition>
    </div>
  )
}

function Ligne({ formule, onModifier }: { formule: FormuleDetail; onModifier: () => void }) {
  const f = fr.formules
  const details = [
    formule.etapes_par_jour === 0 ? f.etapesSansLimite : f.etapes(formule.etapes_par_jour),
    formule.debats_par_mois === 0 ? f.debatsAucun : f.debats(formule.debats_par_mois),
    f.duree(formule.duree_debat_s),
  ]
  if (formule.acces_communaute) details.push(f.communaute)
  if (formule.produit_store) details.push(formule.produit_store)
  return (
    <div className={`${styles.ligne} ${formule.actif ? '' : styles.ligneInactive}`}>
      <span className={styles.ordre}>{formule.ordre}</span>
      <div>
        <span className={styles.titre}>{formule.nom}</span>
        <p className={styles.detail}>{details.join(' · ')}</p>
      </div>
      <div className={styles.badges}>
        <span className={styles.badge}>{formule.cle}</span>
        {formule.actif ? null : (
          <span className={styles.badgeInactif}>{fr.banques.badges.inactif}</span>
        )}
      </div>
      <div className={styles.actions}>
        <button type="button" className="bouton bouton-secondaire" onClick={onModifier}>
          {f.modifier}
        </button>
      </div>
    </div>
  )
}

function FormulaireFormule({
  initiale,
  creation,
  enregistrement,
  onEnregistrer,
  onAnnuler,
}: {
  initiale: SaisieFormule
  creation: boolean
  enregistrement: boolean
  onEnregistrer: (valeur: FormuleDetail) => void
  onAnnuler: () => void
}) {
  const id = useId()
  const [saisie, setSaisie] = useState<SaisieFormule>(initiale)
  const [erreurs, setErreurs] = useState<Erreurs>({})
  const [cleTouchee, setCleTouchee] = useState(!creation)
  const c = fr.banques.champs
  const f = fr.formules.champs
  const parDefaut = !creation && initiale.cle === FORMULE_PAR_DEFAUT

  function changer<K extends keyof SaisieFormule>(champ: K, valeur: SaisieFormule[K]) {
    setSaisie((courante) => {
      const suivante = { ...courante, [champ]: valeur }
      // The key follows the name until Rebecca writes one of her own.
      if (champ === 'nom' && !cleTouchee) suivante.cle = cleDepuisNom(String(valeur))
      return suivante
    })
    setErreurs((courantes) => {
      if (!(champ in courantes)) return courantes
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
        const resultat = validerFormule(saisie)
        if (!resultat.ok) {
          setErreurs(resultat.erreurs)
          return
        }
        onEnregistrer(resultat.valeur)
      }}
    >
      <div className={styles.grilleChamps}>
        <Champ id={`${id}-nom`} libelle={f.nom} erreur={erreur('nom')}>
          <input
            id={`${id}-nom`}
            className="champ"
            value={saisie.nom}
            onChange={(e) => changer('nom', e.target.value)}
            aria-invalid={erreurs.nom ? 'true' : undefined}
          />
        </Champ>
        <Champ id={`${id}-cle`} libelle={c.cle} aide={f.cleAide} erreur={erreur('cle')}>
          <input
            id={`${id}-cle`}
            className="champ champ-mono"
            value={saisie.cle}
            disabled={!creation}
            onChange={(e) => {
              setCleTouchee(true)
              changer('cle', e.target.value)
            }}
            aria-invalid={erreurs.cle ? 'true' : undefined}
          />
        </Champ>
        <Champ id={`${id}-ordre`} libelle={f.ordre} erreur={erreur('ordre')}>
          <Nombre
            id={`${id}-ordre`}
            valeur={saisie.ordre}
            invalide={Boolean(erreurs.ordre)}
            onChange={(v) => changer('ordre', v)}
          />
        </Champ>
      </div>
      <div className={styles.grilleChamps}>
        <Champ
          id={`${id}-etapes`}
          libelle={f.etapes}
          aide={f.etapesAide}
          erreur={erreur('etapes_par_jour')}
        >
          <Nombre
            id={`${id}-etapes`}
            valeur={saisie.etapes_par_jour}
            invalide={Boolean(erreurs.etapes_par_jour)}
            onChange={(v) => changer('etapes_par_jour', v)}
          />
        </Champ>
        <Champ
          id={`${id}-debats`}
          libelle={f.debats}
          aide={f.debatsAide}
          erreur={erreur('debats_par_mois')}
        >
          <Nombre
            id={`${id}-debats`}
            valeur={saisie.debats_par_mois}
            invalide={Boolean(erreurs.debats_par_mois)}
            onChange={(v) => changer('debats_par_mois', v)}
          />
        </Champ>
        <Champ
          id={`${id}-duree`}
          libelle={f.duree}
          aide={f.dureeAide}
          erreur={erreur('duree_debat_s')}
        >
          <Nombre
            id={`${id}-duree`}
            valeur={saisie.duree_debat_s}
            unite="s"
            invalide={Boolean(erreurs.duree_debat_s)}
            onChange={(v) => changer('duree_debat_s', v)}
          />
        </Champ>
      </div>
      <Champ id={`${id}-produit`} libelle={f.produit} aide={f.produitAide}>
        <input
          id={`${id}-produit`}
          className="champ champ-mono"
          value={saisie.produit_store}
          onChange={(e) => changer('produit_store', e.target.value)}
        />
      </Champ>
      <div className={styles.interrupteurLigne}>
        <Interrupteur
          id={`${id}-communaute`}
          actif={saisie.acces_communaute}
          libelle={f.communaute}
          onChange={(v) => changer('acces_communaute', v)}
        />
        <div>
          <label htmlFor={`${id}-communaute`} className="etiquette" style={{ marginBottom: 0 }}>
            {f.communaute}
          </label>
          <p className={styles.aide}>{f.communauteAide}</p>
        </div>
      </div>
      <div className={styles.interrupteurLigne}>
        <Interrupteur
          id={`${id}-actif`}
          actif={saisie.actif}
          libelle={c.actif}
          disabled={parDefaut}
          onChange={(v) => changer('actif', v)}
        />
        <div>
          <label htmlFor={`${id}-actif`} className="etiquette" style={{ marginBottom: 0 }}>
            {c.actif}
          </label>
          <p className={styles.aide}>{parDefaut ? f.actifParDefaut : f.actifAide}</p>
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
