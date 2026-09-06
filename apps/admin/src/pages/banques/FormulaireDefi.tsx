import { useId, useState } from 'react'
import { Link } from 'react-router'
import { Interrupteur } from '../../composants/Interrupteur'
import { fr } from '../../fr'
import {
  dureeParDefaut,
  FORMATS_DEFI,
  validerDefi,
  type DefiEditable,
  type Erreurs,
  type FormatDefi,
  type ModeleActe,
  type SaisieDefi,
} from '../../modele/defis'
import styles from './Banques.module.css'

type Props = {
  initiale: SaisieDefi
  actes: readonly ModeleActe[]
  /** The key cannot change once a défi exists: paths and tests refer to it. */
  creation: boolean
  enregistrement: boolean
  /** The next free order in an act, so a new défi lands after the others when the act changes. */
  prochainOrdrePour?: (ordreActe: number) => number
  onEnregistrer: (valeur: DefiEditable) => void
}

/** The défi form, shared by creation and edition. Validation is the pure model's. */
export function FormulaireDefi({
  initiale,
  actes,
  creation,
  enregistrement,
  prochainOrdrePour,
  onEnregistrer,
}: Props) {
  const id = useId()
  const [saisie, setSaisie] = useState<SaisieDefi>(initiale)
  const [erreurs, setErreurs] = useState<Erreurs>({})
  const [dureeTouchee, setDureeTouchee] = useState(!creation)
  const [ordreTouche, setOrdreTouche] = useState(!creation)

  function changerActe(ordreActe: string) {
    setSaisie((courante) => ({
      ...courante,
      ordre_acte: ordreActe,
      ordre:
        !ordreTouche && prochainOrdrePour
          ? String(prochainOrdrePour(Number(ordreActe)))
          : courante.ordre,
    }))
  }

  function changer<K extends keyof SaisieDefi>(champ: K, valeur: SaisieDefi[K]) {
    setSaisie((courante) => ({ ...courante, [champ]: valeur }))
    setErreurs((courantes) => {
      if (!(champ in courantes)) return courantes
      const reste = { ...courantes }
      delete reste[champ]
      return reste
    })
  }

  function changerFormat(format: FormatDefi) {
    setSaisie((courante) => ({
      ...courante,
      format,
      duree_max_s: dureeTouchee ? courante.duree_max_s : String(dureeParDefaut(format)),
    }))
  }

  function soumettre(evenement: React.FormEvent) {
    evenement.preventDefault()
    const resultat = validerDefi(saisie)
    if (!resultat.ok) {
      setErreurs(resultat.erreurs)
      return
    }
    onEnregistrer(resultat.valeur)
  }

  const erreur = (champ: string) => {
    const code = erreurs[champ]
    return code ? fr.banques.erreurs[code] : null
  }

  const texte = saisie.format === 'texte'
  const long = saisie.format === 'long'
  const t = fr.defis.edition
  const c = fr.banques.champs

  return (
    <form className={`carte ${styles.formulaire}`} onSubmit={soumettre} noValidate>
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
        <Champ id={`${id}-acte`} libelle={t.acte} erreur={erreur('ordre_acte')}>
          <select
            id={`${id}-acte`}
            className="champ"
            value={saisie.ordre_acte}
            onChange={(e) => changerActe(e.target.value)}
          >
            {actes.map((acte) => (
              <option key={acte.ordre} value={String(acte.ordre)}>
                {fr.defis.acte(acte.ordre)} · {acte.titre}
              </option>
            ))}
          </select>
        </Champ>
        <Champ id={`${id}-ordre`} libelle={t.ordre} erreur={erreur('ordre')}>
          <input
            id={`${id}-ordre`}
            className="champ"
            inputMode="numeric"
            value={saisie.ordre}
            onChange={(e) => {
              setOrdreTouche(true)
              changer('ordre', e.target.value)
            }}
            aria-invalid={erreurs.ordre ? 'true' : undefined}
          />
        </Champ>
        <Champ id={`${id}-format`} libelle={t.format} aide={t.formatAide}>
          <select
            id={`${id}-format`}
            className="champ"
            value={saisie.format}
            onChange={(e) => changerFormat(e.target.value as FormatDefi)}
          >
            {FORMATS_DEFI.map((format) => (
              <option key={format} value={format}>
                {fr.banques.formats[format]}
              </option>
            ))}
          </select>
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

      <Champ
        id={`${id}-consigne`}
        libelle={c.consigne}
        aide={c.consigneAide}
        erreur={erreur('consigne')}
      >
        <textarea
          id={`${id}-consigne`}
          className="champ"
          rows={3}
          value={saisie.consigne}
          onChange={(e) => changer('consigne', e.target.value)}
          aria-invalid={erreurs.consigne ? 'true' : undefined}
        />
      </Champ>

      <Champ id={`${id}-focus`} libelle={t.focus} aide={t.focusAide} erreur={erreur('focus')}>
        <input
          id={`${id}-focus`}
          className="champ"
          value={saisie.focus}
          onChange={(e) => changer('focus', e.target.value)}
        />
      </Champ>

      {texte ? (
        <>
          <Champ id={`${id}-texte`} libelle={t.texte} erreur={erreur('texte_a_lire')}>
            <textarea
              id={`${id}-texte`}
              className="champ"
              rows={3}
              value={saisie.texte_a_lire}
              onChange={(e) => changer('texte_a_lire', e.target.value)}
              aria-invalid={erreurs.texte_a_lire ? 'true' : undefined}
            />
          </Champ>
          <Champ id={`${id}-lecture`} libelle={t.dureeLecture} erreur={erreur('duree_lecture_s')}>
            <Nombre
              id={`${id}-lecture`}
              valeur={saisie.duree_lecture_s}
              unite={t.secondes}
              invalide={Boolean(erreurs.duree_lecture_s)}
              onChange={(v) => changer('duree_lecture_s', v)}
            />
          </Champ>
        </>
      ) : null}

      {long ? (
        <>
          <Champ
            id={`${id}-preparation`}
            libelle={t.preparation}
            erreur={erreur('duree_preparation_s')}
          >
            <Nombre
              id={`${id}-preparation`}
              valeur={saisie.duree_preparation_s}
              unite={t.secondes}
              invalide={Boolean(erreurs.duree_preparation_s)}
              onChange={(v) => changer('duree_preparation_s', v)}
            />
          </Champ>
          <fieldset className={styles.champ} style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="etiquette">{t.plan}</legend>
            <p className={styles.aide}>{t.planAide}</p>
            <div className={styles.appuis}>
              {saisie.plan.map((appui, index) => (
                <div key={index} className={styles.appui}>
                  <span className={styles.appuiNumero}>{index + 1}</span>
                  <input
                    className="champ"
                    aria-label={`${t.appuiTitre} ${index + 1}`}
                    placeholder={t.appuiTitre}
                    value={appui.titre}
                    onChange={(e) =>
                      changer(
                        'plan',
                        saisie.plan.map((a, i) =>
                          i === index ? { ...a, titre: e.target.value } : a,
                        ),
                      )
                    }
                  />
                  <input
                    className="champ"
                    aria-label={`${t.appuiDetail} ${index + 1}`}
                    placeholder={t.appuiDetail}
                    value={appui.detail}
                    onChange={(e) =>
                      changer(
                        'plan',
                        saisie.plan.map((a, i) =>
                          i === index ? { ...a, detail: e.target.value } : a,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="bouton bouton-discret"
                    aria-label={t.retirerAppui(index + 1)}
                    onClick={() =>
                      changer(
                        'plan',
                        saisie.plan.filter((_a, i) => i !== index),
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            {erreur('plan') ? <p className="erreur-champ">{erreur('plan')}</p> : null}
            <button
              type="button"
              className="bouton bouton-secondaire"
              style={{ marginTop: 8 }}
              onClick={() => changer('plan', [...saisie.plan, { titre: '', detail: '' }])}
            >
              {t.ajouterAppui}
            </button>
          </fieldset>
        </>
      ) : null}

      <div className={styles.grilleChamps}>
        <Champ id={`${id}-duree`} libelle={t.dureeMax} erreur={erreur('duree_max_s')}>
          <Nombre
            id={`${id}-duree`}
            valeur={saisie.duree_max_s}
            unite={t.secondes}
            invalide={Boolean(erreurs.duree_max_s)}
            onChange={(v) => {
              setDureeTouchee(true)
              changer('duree_max_s', v)
            }}
          />
        </Champ>
        <Champ id={`${id}-points`} libelle={t.points} erreur={erreur('points')}>
          <Nombre
            id={`${id}-points`}
            valeur={saisie.points}
            invalide={Boolean(erreurs.points)}
            onChange={(v) => changer('points', v)}
          />
        </Champ>
        <Champ
          id={`${id}-seuil`}
          libelle={t.seuil}
          aide={t.seuilAide}
          erreur={erreur('seuil_reussite')}
        >
          <Nombre
            id={`${id}-seuil`}
            valeur={saisie.seuil_reussite}
            invalide={Boolean(erreurs.seuil_reussite)}
            onChange={(v) => changer('seuil_reussite', v)}
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
      </div>

      {creation ? (
        <>
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
              <p className={styles.aide}>{c.actifAide}</p>
            </div>
          </div>
        </>
      ) : null}

      <div className={styles.piedFormulaire}>
        <div>
          <button type="submit" className="bouton bouton-principal" disabled={enregistrement}>
            {fr.commun.enregistrer}
          </button>
          <Link to="/defis" className="bouton bouton-discret">
            {fr.commun.annuler}
          </Link>
        </div>
      </div>
    </form>
  )
}

export function Champ({
  id,
  libelle,
  aide,
  erreur,
  children,
}: {
  id: string
  libelle: string
  aide?: string
  erreur?: string | null
  children: React.ReactNode
}) {
  return (
    <div className={styles.champ}>
      <label htmlFor={id} className="etiquette">
        {libelle}
      </label>
      {children}
      {erreur ? (
        <p className="erreur-champ">{erreur}</p>
      ) : aide ? (
        <p className={styles.aide}>{aide}</p>
      ) : null}
    </div>
  )
}

export function Nombre({
  id,
  valeur,
  unite,
  invalide,
  onChange,
}: {
  id: string
  valeur: string
  unite?: string
  invalide: boolean
  onChange: (valeur: string) => void
}) {
  return (
    <div className={styles.formulaireInline}>
      <input
        id={id}
        className="champ"
        inputMode="decimal"
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalide ? 'true' : undefined}
        style={{ maxWidth: 140 }}
      />
      {unite ? <span className={styles.aide}>{unite}</span> : null}
    </div>
  )
}
