import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { Interrupteur } from '../../composants/Interrupteur'
import { ChampImage } from '../../composants/ChampImage'
import { DialogueEdition } from '../../composants/DialogueEdition'
import { BarreOutils, Echec, Squelette, Vide } from '../../composants/Etats'
import { useRecherche } from '../../composants/useRecherche'
import { useNotifier } from '../../composants/toastContext'
import { fr } from '../../fr'
import type { Erreurs } from '../../modele/defis'
import {
  NOMS_TYPE_RECOMPENSE,
  prochainOrdreRecompense,
  saisieDepuisRecompense,
  saisieRecompenseVierge,
  TYPES_RECOMPENSE,
  validerRecompense,
  type Recompense,
  type RecompenseEditable,
  type SaisieRecompense,
  type TypeRecompense,
} from '../../modele/recompenses'
import {
  chargerRecompenses,
  cleRequeteRecompenses,
  creerRecompense,
  modifierRecompense,
} from '../../services/recompenses'
import { Champ, Nombre } from './FormulaireDefi'
import styles from './Banques.module.css'

/** The shop: rewards with their cost and monthly cap. One form at a time. */
export function Recompenses() {
  const notifier = useNotifier()
  const clientRequetes = useQueryClient()
  const recompenses = useQuery({ queryKey: cleRequeteRecompenses, queryFn: chargerRecompenses })
  const [edition, setEdition] = useState<string | null>(null)
  const filtre = useRecherche(recompenses.data, (r) => [
    r.titre,
    r.cle,
    r.sous_titre,
    r.description,
  ])
  const enEdition = (recompenses.data ?? []).find((r) => r.id === edition) ?? null

  const invalider = () => clientRequetes.invalidateQueries({ queryKey: cleRequeteRecompenses })
  const messageErreur = (erreur: Error) =>
    /duplicate|unique|23505/i.test(erreur.message)
      ? fr.recompenses.erreurDoublon
      : fr.recompenses.erreur

  const creation = useMutation({
    mutationFn: creerRecompense,
    onSuccess: () => {
      void invalider()
      notifier({ type: 'succes', message: fr.recompenses.cree })
      setEdition(null)
    },
    onError: (erreur: Error) =>
      notifier({ type: 'erreur', message: messageErreur(erreur), details: erreur.message }),
  })
  const modification = useMutation({
    mutationFn: modifierRecompense,
    onSuccess: () => {
      void invalider()
      notifier({ type: 'succes', message: fr.recompenses.enregistre })
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
          <h1>{fr.recompenses.titre}</h1>
          <p>{fr.recompenses.intro}</p>
        </div>
        <button
          type="button"
          className="bouton bouton-principal"
          disabled={edition === 'nouveau'}
          onClick={() => setEdition('nouveau')}
        >
          {fr.recompenses.creer}
        </button>
      </header>

      <BarreOutils
        recherche={filtre.recherche}
        onRecherche={filtre.setRecherche}
        placeholder={fr.etats.rechercher}
        compte={filtre.actif ? fr.etats.resultats(filtre.resultats.length) : undefined}
      />

      {recompenses.isPending ? (
        <Squelette lignes={4} />
      ) : recompenses.isError ? (
        <Echec titre={fr.recompenses.erreurChargement} detail={recompenses.error.message} />
      ) : recompenses.data.length === 0 ? (
        <Vide marque="◆" titre={fr.recompenses.vide} />
      ) : filtre.resultats.length === 0 ? (
        <Vide marque="⌕" titre={fr.etats.aucunResultat} texte={fr.etats.aucunResultatTexte} />
      ) : (
        <div className={`carte ${styles.liste}`}>
          {filtre.resultats.map((recompense) => (
            <Ligne
              key={recompense.id}
              recompense={recompense}
              onModifier={() => setEdition(recompense.id)}
            />
          ))}
        </div>
      )}

      <DialogueEdition
        ouvert={edition !== null}
        titre={edition === 'nouveau' ? fr.recompenses.nouvelle : fr.recompenses.modifierTitre}
        onFermer={() => setEdition(null)}
      >
        {edition === 'nouveau' ? (
          <FormulaireRecompense
            initiale={saisieRecompenseVierge(prochainOrdreRecompense(recompenses.data ?? []))}
            creation
            enregistrement={enregistrement}
            onEnregistrer={(valeur) => creation.mutate(valeur)}
            onAnnuler={() => setEdition(null)}
          />
        ) : enEdition ? (
          <FormulaireRecompense
            initiale={saisieDepuisRecompense(enEdition)}
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

function Ligne({ recompense, onModifier }: { recompense: Recompense; onModifier: () => void }) {
  const details = [
    NOMS_TYPE_RECOMPENSE[recompense.type],
    recompense.cout_points === null
      ? fr.recompenses.sansCout
      : fr.recompenses.cout(recompense.cout_points),
    recompense.plafond_par_mois === null
      ? fr.recompenses.sansPlafond
      : fr.recompenses.plafond(recompense.plafond_par_mois),
  ]
  return (
    <div className={`${styles.ligne} ${recompense.actif ? '' : styles.ligneInactive}`}>
      <span className={styles.ordre}>{recompense.ordre}</span>
      <div>
        <span className={styles.titre}>{recompense.titre}</span>
        <p className={styles.detail}>
          {details.join(' · ')}
          {recompense.sous_titre ? ` · ${recompense.sous_titre}` : ''}
        </p>
      </div>
      <div className={styles.badges}>
        {recompense.provisoire ? (
          <span className={styles.badge}>{fr.banques.badges.provisoire}</span>
        ) : (
          <span className={styles.badgeValide}>{fr.banques.badges.valide}</span>
        )}
        {recompense.actif ? null : (
          <span className={styles.badgeInactif}>{fr.banques.badges.inactif}</span>
        )}
      </div>
      <div className={styles.actions}>
        <button type="button" className="bouton bouton-secondaire" onClick={onModifier}>
          {fr.recompenses.modifier}
        </button>
      </div>
    </div>
  )
}

function FormulaireRecompense({
  initiale,
  creation,
  enregistrement,
  onEnregistrer,
  onAnnuler,
}: {
  initiale: SaisieRecompense
  creation: boolean
  enregistrement: boolean
  onEnregistrer: (valeur: RecompenseEditable) => void
  onAnnuler: () => void
}) {
  const id = useId()
  const [saisie, setSaisie] = useState<SaisieRecompense>(initiale)
  const [erreurs, setErreurs] = useState<Erreurs>({})
  const c = fr.banques.champs
  const r = fr.recompenses.champs
  const distinction = saisie.type === 'distinction'

  function changer<K extends keyof SaisieRecompense>(champ: K, valeur: SaisieRecompense[K]) {
    setSaisie((courante) => ({ ...courante, [champ]: valeur }))
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
        const resultat = validerRecompense(saisie)
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
        <Champ id={`${id}-type`} libelle={r.type} aide={r.typeAide}>
          <select
            id={`${id}-type`}
            className="champ"
            value={saisie.type}
            onChange={(e) => changer('type', e.target.value as TypeRecompense)}
          >
            {TYPES_RECOMPENSE.map((type) => (
              <option key={type} value={type}>
                {NOMS_TYPE_RECOMPENSE[type]}
              </option>
            ))}
          </select>
        </Champ>
        <Champ id={`${id}-ordre`} libelle={r.ordre} erreur={erreur('ordre')}>
          <Nombre
            id={`${id}-ordre`}
            valeur={saisie.ordre}
            invalide={Boolean(erreurs.ordre)}
            onChange={(v) => changer('ordre', v)}
          />
        </Champ>
      </div>
      <Champ id={`${id}-titre`} libelle={c.titre} erreur={erreur('titre')}>
        <input
          id={`${id}-titre`}
          className="champ"
          value={saisie.titre}
          onChange={(e) => changer('titre', e.target.value)}
          aria-invalid={erreurs.titre ? 'true' : undefined}
        />
      </Champ>
      <ChampImage
        usage="recompenses"
        valeur={saisie.image_chemin}
        onChange={(chemin) => changer('image_chemin', chemin)}
        libelle={r.image}
        aide={r.imageAide}
      />
      <div className={styles.grilleChamps}>
        <Champ id={`${id}-sous-titre`} libelle={r.sousTitre}>
          <input
            id={`${id}-sous-titre`}
            className="champ"
            value={saisie.sous_titre}
            onChange={(e) => changer('sous_titre', e.target.value)}
          />
        </Champ>
        <Champ id={`${id}-description`} libelle={r.description}>
          <input
            id={`${id}-description`}
            className="champ"
            value={saisie.description}
            onChange={(e) => changer('description', e.target.value)}
          />
        </Champ>
      </div>
      {distinction ? (
        <p className={styles.aide}>{r.distinctionAide}</p>
      ) : (
        <div className={styles.grilleChamps}>
          <Champ id={`${id}-cout`} libelle={r.cout} erreur={erreur('cout_points')}>
            <Nombre
              id={`${id}-cout`}
              valeur={saisie.cout_points}
              unite="pts"
              invalide={Boolean(erreurs.cout_points)}
              onChange={(v) => changer('cout_points', v)}
            />
          </Champ>
          <Champ
            id={`${id}-plafond`}
            libelle={r.plafond}
            aide={r.plafondAide}
            erreur={erreur('plafond_par_mois')}
          >
            <Nombre
              id={`${id}-plafond`}
              valeur={saisie.plafond_par_mois}
              invalide={Boolean(erreurs.plafond_par_mois)}
              onChange={(v) => changer('plafond_par_mois', v)}
            />
          </Champ>
        </div>
      )}
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
          <p className={styles.aide}>{r.provisoireAide}</p>
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
          <p className={styles.aide}>{r.actifAide}</p>
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
