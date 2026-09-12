import { useId } from 'react'

import { Interrupteur } from '../../composants/Interrupteur'
import { fr } from '../../fr'
import { uniteDeCle, type EntreeConfiguration } from '../../modele/configuration'
import { estModifie, texteDeValeur, validerSaisie, type Saisie } from './validation'
import styles from './Configuration.module.css'

type Props = {
  ligne: EntreeConfiguration
  /** The value being edited, or undefined when the row is untouched. */
  saisie: Saisie | undefined
  desactive: boolean
  onSaisie: (cle: string, saisie: Saisie | undefined) => void
}

/**
 * One setting: what it does, in words, then the field. The key is shown as a small technical
 * chip rather than as the title, because the person reading this page thinks in "how long may
 * a duel last", not in `duree_duel_heures`.
 *
 * The row holds no save button. Editing many settings and pressing save twenty-four times was
 * the shape of the old page; the bar at the bottom of the page saves them together.
 */
export function LigneConfiguration({ ligne, saisie, desactive, onSaisie }: Props) {
  const idChamp = useId()
  const courante = saisie ?? texteDeValeur(ligne.type, ligne.valeur)
  const modifie = saisie !== undefined && estModifie(ligne.type, ligne.valeur, courante)
  const validation = validerSaisie(ligne.cle, ligne.type, courante)
  const erreur = modifie && !validation.ok ? validation.erreur : null
  const unite = ligne.type === 'nombre' ? uniteDeCle(ligne.cle) : null

  const changer = (valeur: Saisie) => {
    onSaisie(ligne.cle, estModifie(ligne.type, ligne.valeur, valeur) ? valeur : undefined)
  }

  return (
    <div className={styles.ligne} data-modifie={modifie ? 'true' : undefined}>
      <div className={styles.libelle}>
        <label htmlFor={idChamp} className={styles.description}>
          {ligne.description}
        </label>
        <span className="cle-technique">{ligne.cle}</span>
      </div>

      <div className={styles.champ}>
        {ligne.type === 'booleen' ? (
          <Interrupteur
            id={idChamp}
            actif={courante === true}
            libelle={fr.configuration.champ.valeurDe(ligne.cle)}
            disabled={desactive}
            onChange={changer}
          />
        ) : ligne.type === 'json' ? (
          <textarea
            id={idChamp}
            className="champ champ-mono"
            rows={4}
            value={String(courante)}
            aria-invalid={erreur !== null}
            aria-label={fr.configuration.champ.valeurDe(ligne.cle)}
            disabled={desactive}
            onChange={(e) => changer(e.target.value)}
          />
        ) : (
          <div className={styles.champAvecUnite}>
            <input
              id={idChamp}
              className={ligne.type === 'nombre' ? 'champ champ-mono' : 'champ'}
              type={ligne.type === 'nombre' ? 'number' : 'text'}
              inputMode={ligne.type === 'nombre' ? 'decimal' : 'text'}
              step={ligne.type === 'nombre' ? 'any' : undefined}
              value={String(courante)}
              aria-invalid={erreur !== null}
              aria-label={fr.configuration.champ.valeurDe(ligne.cle)}
              disabled={desactive}
              onChange={(e) => changer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') onSaisie(ligne.cle, undefined)
              }}
            />
            {unite ? <span className={styles.unite}>{unite}</span> : null}
          </div>
        )}
        {erreur ? <p className="erreur-champ">{erreur}</p> : null}
      </div>

      <div className={styles.actions}>
        {modifie ? (
          <button
            type="button"
            className="bouton bouton-icone"
            title={fr.configuration.champ.annulerPour(ligne.cle)}
            aria-label={fr.configuration.champ.annulerPour(ligne.cle)}
            disabled={desactive}
            onClick={() => onSaisie(ligne.cle, undefined)}
          >
            ↺
          </button>
        ) : null}
      </div>
    </div>
  )
}
