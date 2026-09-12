import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { TONS_ADVERSAIRE, type These, type TheseEditable } from '@leq/domaine'

import { Interrupteur } from '../../composants/Interrupteur'
import { BarreOutils, Echec, Squelette, Vide } from '../../composants/Etats'
import { DialogueEdition } from '../../composants/DialogueEdition'
import { useRecherche } from '../../composants/useRecherche'
import { useNotifier } from '../../composants/toastContext'
import { fr } from '../../fr'
import type { Erreurs } from '../../modele/defis'
import {
  prochainOrdreThese,
  proposeesMaintenant,
  saisieDepuisThese,
  saisieTheseVierge,
  validerThese,
  type SaisieThese,
} from '../../modele/theses'
import { chargerTheses, cleRequeteTheses, creerThese, modifierThese } from '../../services/arene'
import { Champ, Nombre } from '../banques/FormulaireDefi'
import styles from '../banques/Banques.module.css'

/**
 * The bank of debate theses. Chapter 10: this is what the application offers first, because
 * most people asked to invent a debate subject freeze or pick one they cannot defend, and the
 * session is lost before it has started.
 */
export function Theses() {
  const notifier = useNotifier()
  const clientRequetes = useQueryClient()
  const theses = useQuery({ queryKey: cleRequeteTheses, queryFn: chargerTheses })
  const [edition, setEdition] = useState<string | null>(null)
  const filtre = useRecherche(theses.data, (t) => [t.texte, t.cle, t.ton_suggere])

  const invalider = () => clientRequetes.invalidateQueries({ queryKey: cleRequeteTheses })
  const messageErreur = (erreur: Error) =>
    /duplicate|unique|23505/i.test(erreur.message) ? fr.theses.erreurDoublon : fr.theses.erreur

  const creation = useMutation({
    mutationFn: creerThese,
    onSuccess: () => {
      void invalider()
      notifier({ type: 'succes', message: fr.theses.cree })
      setEdition(null)
    },
    onError: (erreur: Error) =>
      notifier({ type: 'erreur', message: messageErreur(erreur), details: erreur.message }),
  })
  const modification = useMutation({
    mutationFn: modifierThese,
    onSuccess: () => {
      void invalider()
      notifier({ type: 'succes', message: fr.theses.enregistre })
      setEdition(null)
    },
    onError: (erreur: Error) =>
      notifier({ type: 'erreur', message: messageErreur(erreur), details: erreur.message }),
  })
  const enregistrement = creation.isPending || modification.isPending
  const proposees = new Set(proposeesMaintenant(theses.data ?? []).map((these) => these.id))
  const enEdition = (theses.data ?? []).find((these) => these.id === edition) ?? null

  return (
    <div className="page">
      <header className={styles.entete}>
        <div>
          <h1>{fr.theses.titre}</h1>
          <p>{fr.theses.intro}</p>
        </div>
        <button
          type="button"
          className="bouton bouton-principal"
          disabled={edition === 'nouveau'}
          onClick={() => setEdition('nouveau')}
        >
          {fr.theses.creer}
        </button>
      </header>

      <BarreOutils
        recherche={filtre.recherche}
        onRecherche={filtre.setRecherche}
        placeholder={fr.etats.rechercher}
        compte={filtre.actif ? fr.etats.resultats(filtre.resultats.length) : undefined}
      />

      {theses.isPending ? (
        <Squelette lignes={4} />
      ) : theses.isError ? (
        <Echec titre={fr.theses.erreurChargement} detail={theses.error.message} />
      ) : theses.data.length === 0 ? (
        <Vide marque="✎" titre={fr.theses.vide} />
      ) : filtre.resultats.length === 0 ? (
        <Vide marque="⌕" titre={fr.etats.aucunResultat} texte={fr.etats.aucunResultatTexte} />
      ) : (
        <div className={`carte ${styles.liste}`}>
          {filtre.resultats.map((these) => (
            <Ligne
              key={these.id}
              these={these}
              proposee={proposees.has(these.id)}
              onModifier={() => setEdition(these.id)}
            />
          ))}
        </div>
      )}

      {/* One thing on screen at a time: editing inside the list, with the next row visible
          underneath, made it easy to lose track of what was being changed. */}
      <DialogueEdition
        ouvert={edition !== null}
        titre={edition === 'nouveau' ? fr.theses.creer : fr.theses.modifierTitre}
        description={edition === 'nouveau' ? fr.theses.creerAide : undefined}
        onFermer={() => setEdition(null)}
      >
        {edition === 'nouveau' ? (
          <FormulaireThese
            initiale={saisieTheseVierge(prochainOrdreThese(theses.data ?? []))}
            creation
            enregistrement={enregistrement}
            onEnregistrer={(valeur) => creation.mutate(valeur)}
            onAnnuler={() => setEdition(null)}
          />
        ) : enEdition ? (
          <FormulaireThese
            initiale={saisieDepuisThese(enEdition)}
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

function Ligne({
  these,
  proposee,
  onModifier,
}: {
  these: These
  proposee: boolean
  onModifier: () => void
}) {
  return (
    <div className={`${styles.ligne} ${these.actif ? '' : styles.ligneInactive}`}>
      <span className={styles.ordre}>{these.ordre}</span>
      <div>
        <span className={styles.titre}>{these.texte}</span>
        <p className={styles.detail}>
          <span className="mono">{these.cle}</span> · {fr.theses.tons[these.ton_suggere]}
        </p>
      </div>
      <div className={styles.badges}>
        {proposee ? <span className={styles.badgeValide}>{fr.theses.proposees}</span> : null}
        {these.provisoire ? (
          <span className={styles.badge}>{fr.banques.badges.provisoire}</span>
        ) : null}
      </div>
      <div className={styles.actions}>
        <button type="button" className="bouton bouton-secondaire" onClick={onModifier}>
          {fr.theses.modifier}
        </button>
      </div>
    </div>
  )
}

function FormulaireThese({
  initiale,
  creation,
  enregistrement,
  onEnregistrer,
  onAnnuler,
}: {
  initiale: SaisieThese
  creation: boolean
  enregistrement: boolean
  onEnregistrer: (valeur: TheseEditable) => void
  onAnnuler: () => void
}) {
  const id = useId()
  const [saisie, setSaisie] = useState<SaisieThese>(initiale)
  const [erreurs, setErreurs] = useState<Erreurs>({})
  const c = fr.banques.champs
  const s = fr.theses.champs
  const changer = <K extends keyof SaisieThese>(champ: K, valeur: SaisieThese[K]) => {
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
        const resultat = validerThese(saisie)
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
        <Champ id={`${id}-ton`} libelle={s.ton} aide={s.tonAide} erreur={erreur('ton_suggere')}>
          <select
            id={`${id}-ton`}
            className="champ"
            value={saisie.ton_suggere}
            onChange={(e) => changer('ton_suggere', e.target.value)}
          >
            {TONS_ADVERSAIRE.map((ton) => (
              <option key={ton} value={ton}>
                {fr.theses.tons[ton]}
              </option>
            ))}
          </select>
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
