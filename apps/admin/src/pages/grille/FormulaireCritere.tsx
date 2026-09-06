import { useId, useState } from 'react'
import { fr } from '../../fr'
import type { Erreurs } from '../../modele/defis'
import {
  bandeVierge,
  CHEMINS_MESURES_V1,
  elementVierge,
  estCheminConnu,
  PREFIXE_PAR_TYPE,
  validerCritere,
  type CritereEditable,
  type SaisieCritere,
} from '../../modele/grille'
import { Champ, Nombre } from '../banques/FormulaireDefi'
import styles from '../banques/Banques.module.css'

type Props = {
  initiale: SaisieCritere
  ordre: number
  enregistrement: boolean
  onEnregistrer: (valeur: CritereEditable) => void
  onAnnuler: () => void
}

/** One criterion: its texts, its maximum, and the elements (a measure, its bands, a weight). */
export function FormulaireCritere({
  initiale,
  ordre,
  enregistrement,
  onEnregistrer,
  onAnnuler,
}: Props) {
  const id = useId()
  const [saisie, setSaisie] = useState<SaisieCritere>(initiale)
  const [erreurs, setErreurs] = useState<Erreurs>({})
  const g = fr.grille.champs
  const erreur = (champ: string) => {
    const code = erreurs[champ]
    return code ? fr.banques.erreurs[code] : null
  }
  const changer = (modif: (s: SaisieCritere) => SaisieCritere) => {
    setSaisie(modif)
    setErreurs({})
  }
  const changerElement = (
    i: number,
    modif: (e: SaisieCritere['elements'][number]) => SaisieCritere['elements'][number],
  ) => changer((s) => ({ ...s, elements: s.elements.map((e, k) => (k === i ? modif(e) : e)) }))

  return (
    <form
      className={`carte ${styles.formulaire}`}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        const resultat = validerCritere(saisie, ordre)
        if (!resultat.ok) {
          setErreurs(resultat.erreurs)
          return
        }
        onEnregistrer(resultat.valeur)
      }}
    >
      <div className={styles.grilleChamps}>
        <Champ id={`${id}-cle`} libelle={g.cle} aide={g.cleAide} erreur={erreur('cle')}>
          <input
            id={`${id}-cle`}
            className="champ champ-mono"
            value={saisie.cle}
            onChange={(e) => changer((s) => ({ ...s, cle: e.target.value }))}
            aria-invalid={erreurs.cle ? 'true' : undefined}
          />
        </Champ>
        <Champ id={`${id}-nom`} libelle={g.nom} erreur={erreur('nom')}>
          <input
            id={`${id}-nom`}
            className="champ"
            value={saisie.nom}
            onChange={(e) => changer((s) => ({ ...s, nom: e.target.value }))}
            aria-invalid={erreurs.nom ? 'true' : undefined}
          />
        </Champ>
        <Champ
          id={`${id}-max`}
          libelle={g.scoreMax}
          aide={g.scoreMaxAide}
          erreur={erreur('score_max')}
        >
          <Nombre
            id={`${id}-max`}
            valeur={saisie.score_max}
            invalide={Boolean(erreurs.score_max)}
            onChange={(v) => changer((s) => ({ ...s, score_max: v }))}
          />
        </Champ>
      </div>
      <Champ
        id={`${id}-definition`}
        libelle={g.definition}
        aide={g.definitionAide}
        erreur={erreur('definition')}
      >
        <textarea
          id={`${id}-definition`}
          className="champ"
          rows={2}
          value={saisie.definition}
          onChange={(e) => changer((s) => ({ ...s, definition: e.target.value }))}
          aria-invalid={erreurs.definition ? 'true' : undefined}
        />
      </Champ>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="etiquette">{g.elements}</legend>
        <p className={styles.aide}>{g.elementsAide}</p>
        {erreur('elements') ? <p className="erreur-champ">{erreur('elements')}</p> : null}
        <div className={styles.appuis}>
          {saisie.elements.map((element, i) => (
            <div key={i} className="carte" style={{ padding: 14, display: 'grid', gap: 10 }}>
              <div className={styles.grilleChamps}>
                <Champ
                  id={`${id}-mesure-${i}`}
                  libelle={g.mesure}
                  aide={g.mesureAide}
                  erreur={erreur(`elements.${i}.mesure`)}
                >
                  <select
                    id={`${id}-mesure-${i}`}
                    className="champ champ-mono"
                    value={
                      estCheminConnu(element.mesure) && !element.mesure.startsWith(PREFIXE_PAR_TYPE)
                        ? element.mesure
                        : PREFIXE_PAR_TYPE
                    }
                    onChange={(e) =>
                      changerElement(i, (el) => ({
                        ...el,
                        mesure:
                          e.target.value === PREFIXE_PAR_TYPE
                            ? `${PREFIXE_PAR_TYPE}euh`
                            : e.target.value,
                      }))
                    }
                  >
                    {CHEMINS_MESURES_V1.map((chemin) => (
                      <option key={chemin} value={chemin}>
                        {chemin}
                      </option>
                    ))}
                    <option value={PREFIXE_PAR_TYPE}>{g.parType}</option>
                  </select>
                </Champ>
                {element.mesure.startsWith(PREFIXE_PAR_TYPE) ? (
                  <Champ id={`${id}-mot-${i}`} libelle={g.mot}>
                    <input
                      id={`${id}-mot-${i}`}
                      className="champ champ-mono"
                      value={element.mesure.slice(PREFIXE_PAR_TYPE.length)}
                      onChange={(e) =>
                        changerElement(i, (el) => ({
                          ...el,
                          mesure: `${PREFIXE_PAR_TYPE}${e.target.value}`,
                        }))
                      }
                    />
                  </Champ>
                ) : null}
                <Champ
                  id={`${id}-poids-${i}`}
                  libelle={g.poids}
                  aide={g.poidsAide}
                  erreur={erreur(`elements.${i}.poids`)}
                >
                  <Nombre
                    id={`${id}-poids-${i}`}
                    valeur={element.poids}
                    invalide={Boolean(erreurs[`elements.${i}.poids`])}
                    onChange={(v) => changerElement(i, (el) => ({ ...el, poids: v }))}
                  />
                </Champ>
              </div>
              <div>
                <span className="etiquette">{g.bandes}</span>
                <p className={styles.aide}>{g.bandesAide}</p>
                {erreur(`elements.${i}.bandes`) ? (
                  <p className="erreur-champ">{erreur(`elements.${i}.bandes`)}</p>
                ) : null}
                <div className={styles.appuis}>
                  {element.bandes.map((bande, j) => (
                    <div key={j} className={styles.appui}>
                      <span className={styles.appuiNumero}>{j + 1}</span>
                      <input
                        className="champ"
                        aria-label={`${g.min} ${j + 1}`}
                        placeholder={g.min}
                        value={bande.min}
                        aria-invalid={erreurs[`elements.${i}.bandes.${j}.min`] ? 'true' : undefined}
                        onChange={(e) =>
                          changerElement(i, (el) => ({
                            ...el,
                            bandes: el.bandes.map((b, k) =>
                              k === j ? { ...b, min: e.target.value } : b,
                            ),
                          }))
                        }
                      />
                      <input
                        className="champ"
                        aria-label={`${g.max} ${j + 1}`}
                        placeholder={g.max}
                        value={bande.max}
                        aria-invalid={erreurs[`elements.${i}.bandes.${j}.max`] ? 'true' : undefined}
                        onChange={(e) =>
                          changerElement(i, (el) => ({
                            ...el,
                            bandes: el.bandes.map((b, k) =>
                              k === j ? { ...b, max: e.target.value } : b,
                            ),
                          }))
                        }
                      />
                      <div className={styles.formulaireInline}>
                        <input
                          className="champ"
                          style={{ maxWidth: 90 }}
                          aria-label={`${g.score} ${j + 1}`}
                          placeholder={g.score}
                          value={bande.score}
                          aria-invalid={
                            erreurs[`elements.${i}.bandes.${j}.score`] ? 'true' : undefined
                          }
                          onChange={(e) =>
                            changerElement(i, (el) => ({
                              ...el,
                              bandes: el.bandes.map((b, k) =>
                                k === j ? { ...b, score: e.target.value } : b,
                              ),
                            }))
                          }
                        />
                        <button
                          type="button"
                          className="bouton bouton-discret"
                          aria-label={g.retirerBande(j + 1)}
                          onClick={() =>
                            changerElement(i, (el) => ({
                              ...el,
                              bandes: el.bandes.filter((_b, k) => k !== j),
                            }))
                          }
                        >
                          ×
                        </button>
                      </div>
                      {['min', 'max', 'score'].map((champ) =>
                        erreur(`elements.${i}.bandes.${j}.${champ}`) ? (
                          <p key={champ} className="erreur-champ" style={{ gridColumn: '1 / -1' }}>
                            {erreur(`elements.${i}.bandes.${j}.${champ}`)}
                          </p>
                        ) : null,
                      )}
                    </div>
                  ))}
                </div>
                <div className={styles.formulaireInline} style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="bouton bouton-secondaire"
                    onClick={() =>
                      changerElement(i, (el) => ({ ...el, bandes: [...el.bandes, bandeVierge()] }))
                    }
                  >
                    {g.ajouterBande}
                  </button>
                  <button
                    type="button"
                    className="bouton bouton-discret"
                    onClick={() =>
                      changer((s) => ({ ...s, elements: s.elements.filter((_e, k) => k !== i) }))
                    }
                  >
                    {g.retirerElement}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="bouton bouton-secondaire"
          style={{ marginTop: 8 }}
          onClick={() => changer((s) => ({ ...s, elements: [...s.elements, elementVierge()] }))}
        >
          {g.ajouterElement}
        </button>
      </fieldset>

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
