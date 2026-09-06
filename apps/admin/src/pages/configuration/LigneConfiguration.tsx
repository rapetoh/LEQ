import { useId, useState } from 'react'
import { Interrupteur } from '../../composants/Interrupteur'
import { fr } from '../../fr'
import { uniteDeCle, type EntreeConfiguration } from '../../modele/configuration'
import { estModifie, texteDeValeur, validerSaisie, type Saisie } from './validation'
import styles from './Configuration.module.css'

type Props = {
  ligne: EntreeConfiguration
  enregistrement: boolean
  onEnregistrer: (cle: string, valeur: unknown) => void
}

/** One row: description, a field of the right type, cancel and save. */
export function LigneConfiguration({ ligne, enregistrement, onEnregistrer }: Props) {
  const idChamp = useId()
  const [saisie, setSaisie] = useState<Saisie>(() => texteDeValeur(ligne.type, ligne.valeur))

  // When the stored value changes under the field (a save elsewhere, or the rollback after an
  // error), the field follows it. Adjusting state during render is React's own pattern for
  // state derived from props; it avoids an extra render from an effect.
  const empreinte = JSON.stringify(ligne.valeur)
  const [empreinteVue, setEmpreinteVue] = useState(empreinte)
  if (empreinteVue !== empreinte) {
    setEmpreinteVue(empreinte)
    setSaisie(texteDeValeur(ligne.type, ligne.valeur))
  }

  const modifie = estModifie(ligne.type, ligne.valeur, saisie)
  const validation = validerSaisie(ligne.cle, ligne.type, saisie)
  const erreur = modifie && !validation.ok ? validation.erreur : null
  const unite = ligne.type === 'nombre' ? uniteDeCle(ligne.cle) : null

  function annuler() {
    setSaisie(texteDeValeur(ligne.type, ligne.valeur))
  }

  function enregistrer() {
    if (!validation.ok || !modifie) return
    onEnregistrer(ligne.cle, validation.valeur)
  }

  return (
    <div className={styles.ligne}>
      <div className={styles.libelle}>
        <label htmlFor={idChamp} className={styles.cle}>
          {ligne.cle}
        </label>
        <p className={styles.description}>{ligne.description}</p>
      </div>

      <div className={styles.champ}>
        {ligne.type === 'booleen' ? (
          <Interrupteur
            id={idChamp}
            actif={saisie === true}
            libelle={fr.configuration.champ.valeurDe(ligne.cle)}
            disabled={enregistrement}
            onChange={setSaisie}
          />
        ) : ligne.type === 'json' ? (
          <textarea
            id={idChamp}
            className="champ champ-mono"
            rows={4}
            value={String(saisie)}
            aria-invalid={erreur !== null}
            aria-label={fr.configuration.champ.valeurDe(ligne.cle)}
            disabled={enregistrement}
            onChange={(e) => setSaisie(e.target.value)}
          />
        ) : (
          <div className={styles.champAvecUnite}>
            <input
              id={idChamp}
              className={ligne.type === 'nombre' ? 'champ champ-mono' : 'champ'}
              type={ligne.type === 'nombre' ? 'number' : 'text'}
              inputMode={ligne.type === 'nombre' ? 'decimal' : 'text'}
              step={ligne.type === 'nombre' ? 'any' : undefined}
              value={String(saisie)}
              aria-invalid={erreur !== null}
              aria-label={fr.configuration.champ.valeurDe(ligne.cle)}
              disabled={enregistrement}
              onChange={(e) => setSaisie(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') enregistrer()
                if (e.key === 'Escape') annuler()
              }}
            />
            {unite ? <span className={styles.unite}>{unite}</span> : null}
          </div>
        )}
        {erreur ? <p className="erreur-champ">{erreur}</p> : null}
        {modifie && !erreur ? (
          <p className={styles.etatModifie}>{fr.configuration.etats.modifie}</p>
        ) : null}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className="bouton bouton-discret"
          disabled={!modifie || enregistrement}
          aria-label={fr.configuration.champ.annulerPour(ligne.cle)}
          onClick={annuler}
        >
          {fr.commun.annuler}
        </button>
        <button
          type="button"
          className="bouton bouton-principal"
          disabled={!modifie || !validation.ok || enregistrement}
          aria-label={fr.configuration.champ.enregistrerPour(ligne.cle)}
          onClick={enregistrer}
        >
          {enregistrement ? fr.configuration.etats.enregistrement : fr.commun.enregistrer}
        </button>
      </div>
    </div>
  )
}
