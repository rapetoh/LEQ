import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { Interrupteur } from '../../composants/Interrupteur'
import { useNotifier } from '../../composants/toastContext'
import { fr } from '../../fr'
import {
  saisieDepuisExercice,
  saisieExerciceVierge,
  validerExercice,
  type Erreurs,
  type Exercice,
  type ExerciceEditable,
  type SaisieExercice,
} from '../../modele/defis'
import {
  chargerExercices,
  cleRequeteExercices,
  creerExercice,
  modifierExercice,
} from '../../services/defis'
import { Champ, Nombre } from './FormulaireDefi'
import styles from './Banques.module.css'

/** The bank of remediation exercises: a list, and one form at a time (new, or the row edited). */
export function Exercices() {
  const notifier = useNotifier()
  const clientRequetes = useQueryClient()
  const exercices = useQuery({ queryKey: cleRequeteExercices, queryFn: chargerExercices })
  const [edition, setEdition] = useState<string | null>(null)

  const invalider = () => void clientRequetes.invalidateQueries({ queryKey: cleRequeteExercices })
  const messageErreur = (erreur: Error) =>
    /duplicate|unique|23505/i.test(erreur.message)
      ? fr.exercices.erreurDoublon
      : fr.exercices.erreur

  const creation = useMutation({
    mutationFn: creerExercice,
    onSuccess: () => {
      invalider()
      notifier({ type: 'succes', message: fr.exercices.cree })
      setEdition(null)
    },
    onError: (erreur: Error) =>
      notifier({ type: 'erreur', message: messageErreur(erreur), details: erreur.message }),
  })
  const modification = useMutation({
    mutationFn: modifierExercice,
    onSuccess: () => {
      invalider()
      notifier({ type: 'succes', message: fr.exercices.enregistre })
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
          <h1>{fr.exercices.titre}</h1>
          <p>{fr.exercices.intro}</p>
        </div>
        <button
          type="button"
          className="bouton bouton-principal"
          disabled={edition === 'nouveau'}
          onClick={() => setEdition('nouveau')}
        >
          {fr.exercices.creer}
        </button>
      </header>

      {edition === 'nouveau' ? (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ marginBottom: 10 }}>{fr.exercices.nouveau}</h2>
          <FormulaireExercice
            initiale={saisieExerciceVierge()}
            creation
            enregistrement={enregistrement}
            onEnregistrer={(valeur) => creation.mutate(valeur)}
            onAnnuler={() => setEdition(null)}
          />
        </div>
      ) : null}

      {exercices.isPending ? (
        <p className="etat" role="status">
          {fr.commun.chargement}
        </p>
      ) : exercices.isError ? (
        <div className="etat etat-erreur" role="alert">
          <p>{fr.exercices.erreurChargement}</p>
          <p className="mono">{exercices.error.message}</p>
          <button
            type="button"
            className="bouton bouton-secondaire"
            onClick={() => void exercices.refetch()}
          >
            {fr.commun.reessayer}
          </button>
        </div>
      ) : exercices.data.length === 0 ? (
        <p className="etat">{fr.exercices.vide}</p>
      ) : (
        <div className={`carte ${styles.liste}`}>
          {exercices.data.map((exercice) =>
            edition === exercice.id ? (
              <div key={exercice.id} style={{ padding: 4 }}>
                <FormulaireExercice
                  initiale={saisieDepuisExercice(exercice)}
                  creation={false}
                  enregistrement={enregistrement}
                  onEnregistrer={(valeur) => modification.mutate({ id: exercice.id, valeur })}
                  onAnnuler={() => setEdition(null)}
                />
              </div>
            ) : (
              <Ligne
                key={exercice.id}
                exercice={exercice}
                onModifier={() => setEdition(exercice.id)}
              />
            ),
          )}
        </div>
      )}
    </div>
  )
}

function Ligne({ exercice, onModifier }: { exercice: Exercice; onModifier: () => void }) {
  return (
    <div className={`${styles.ligne} ${exercice.actif ? '' : styles.ligneInactive}`}>
      <span className={styles.ordre}>{fr.exercices.duree(exercice.duree_s)}</span>
      <div>
        <span className={styles.titre}>{exercice.titre}</span>
        <p className={styles.detail}>
          {exercice.consigne} · {fr.exercices.competence(exercice.competence)}
        </p>
      </div>
      <div className={styles.badges}>
        {exercice.provisoire ? (
          <span className={styles.badge}>{fr.banques.badges.provisoire}</span>
        ) : (
          <span className={styles.badgeValide}>{fr.banques.badges.valide}</span>
        )}
        {exercice.actif ? null : (
          <span className={styles.badgeInactif}>{fr.banques.badges.inactif}</span>
        )}
      </div>
      <div className={styles.actions}>
        <button type="button" className="bouton bouton-secondaire" onClick={onModifier}>
          {fr.exercices.modifier}
        </button>
      </div>
    </div>
  )
}

function FormulaireExercice({
  initiale,
  creation,
  enregistrement,
  onEnregistrer,
  onAnnuler,
}: {
  initiale: SaisieExercice
  creation: boolean
  enregistrement: boolean
  onEnregistrer: (valeur: ExerciceEditable) => void
  onAnnuler: () => void
}) {
  const id = useId()
  const [saisie, setSaisie] = useState<SaisieExercice>(initiale)
  const [erreurs, setErreurs] = useState<Erreurs>({})
  const c = fr.banques.champs

  function changer<K extends keyof SaisieExercice>(champ: K, valeur: SaisieExercice[K]) {
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
        const resultat = validerExercice(saisie)
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
        <Champ
          id={`${id}-competence`}
          libelle={c.competence}
          aide={c.competenceAide}
          erreur={erreur('competence')}
        >
          <input
            id={`${id}-competence`}
            className="champ champ-mono"
            value={saisie.competence}
            onChange={(e) => changer('competence', e.target.value)}
            aria-invalid={erreurs.competence ? 'true' : undefined}
          />
        </Champ>
        <Champ id={`${id}-duree`} libelle={fr.exercices.dureeChamp} erreur={erreur('duree_s')}>
          <Nombre
            id={`${id}-duree`}
            valeur={saisie.duree_s}
            unite={fr.defis.edition.secondes}
            invalide={Boolean(erreurs.duree_s)}
            onChange={(v) => changer('duree_s', v)}
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
      <Champ id={`${id}-consigne`} libelle={c.consigne} erreur={erreur('consigne')}>
        <textarea
          id={`${id}-consigne`}
          className="champ"
          rows={2}
          value={saisie.consigne}
          onChange={(e) => changer('consigne', e.target.value)}
          aria-invalid={erreurs.consigne ? 'true' : undefined}
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
          <p className={styles.aide}>{c.provisoireAide}</p>
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
          <p className={styles.aide}>{c.actifAideExercice}</p>
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
