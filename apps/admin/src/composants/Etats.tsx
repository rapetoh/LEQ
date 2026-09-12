import type { ReactNode } from 'react'

/**
 * What a page shows when it has nothing, when it is waiting, and when it failed. Written once:
 * a bare sentence floating in an empty page was the same admin tell as a form with no rhythm.
 */

export function Vide({
  marque = '·',
  titre,
  texte,
  action,
}: {
  marque?: string
  titre: string
  texte?: string | undefined
  action?: ReactNode
}) {
  return (
    <div className="vide">
      <span className="vide-marque" aria-hidden="true">
        {marque}
      </span>
      <h2>{titre}</h2>
      {texte ? <p>{texte}</p> : null}
      {action}
    </div>
  )
}

/** Waiting looks like the rows that are coming, not like the word "chargement". */
export function Squelette({ lignes = 4 }: { lignes?: number }) {
  return (
    <div className="carte squelette-liste" role="status" aria-live="polite">
      {Array.from({ length: lignes }, (_, i) => (
        <div key={i} className="squelette squelette-ligne" />
      ))}
    </div>
  )
}

export function Echec({ titre, detail }: { titre: string; detail?: string | undefined }) {
  return (
    <div className="etat etat-erreur" role="alert">
      <p>{titre}</p>
      {detail ? <p className="mono">{detail}</p> : null}
    </div>
  )
}

/** Search plus filters plus the page's own action, in one row. */
export function BarreOutils({
  recherche,
  onRecherche,
  placeholder,
  compte,
  children,
}: {
  recherche?: string | undefined
  onRecherche?: ((valeur: string) => void) | undefined
  placeholder?: string | undefined
  compte?: string | undefined
  children?: ReactNode
}) {
  return (
    <div className="barre-outils">
      {onRecherche ? (
        <div className="recherche">
          <input
            type="search"
            className="champ"
            value={recherche ?? ''}
            placeholder={placeholder}
            aria-label={placeholder}
            onChange={(e) => onRecherche(e.target.value)}
          />
        </div>
      ) : null}
      {compte ? <span className="compte">{compte}</span> : null}
      {children}
    </div>
  )
}

export function Filtres<T extends string>({
  valeur,
  options,
  onChange,
  libelle,
}: {
  valeur: T
  options: ReadonlyArray<{ cle: T; libelle: string }>
  onChange: (cle: T) => void
  libelle: string
}) {
  return (
    <div className="filtres" role="group" aria-label={libelle}>
      {options.map((option) => (
        <button
          key={option.cle}
          type="button"
          className="filtre"
          aria-pressed={valeur === option.cle}
          onClick={() => onChange(option.cle)}
        >
          {option.libelle}
        </button>
      ))}
    </div>
  )
}
