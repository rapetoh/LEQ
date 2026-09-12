import { useEffect, useId, useRef, type ReactNode } from 'react'

import { fr } from '../fr'
import styles from './DialogueEdition.module.css'

/**
 * A dialog for editing one row.
 *
 * Opening the form inside the list, with the next row still visible under it, makes it easy to
 * lose track of which row is being changed. This puts one thing on screen and pushes the rest
 * of the page behind a dimmed, blurred backdrop.
 *
 * Plain elements rather than `<dialog>`, for the same reason as DialogueConfirmation beside it:
 * the behaviour is then identical in jsdom and in a browser, so it can actually be tested.
 */
export function DialogueEdition({
  ouvert,
  titre,
  description,
  onFermer,
  children,
  large = false,
}: {
  ouvert: boolean
  titre: string
  description?: string | undefined
  onFermer: () => void
  children: ReactNode
  large?: boolean
}) {
  const idTitre = useId()
  const refFermer = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!ouvert) return
    refFermer.current?.focus()
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') onFermer()
    }
    document.addEventListener('keydown', surTouche)
    // The page behind must not scroll under the dialog.
    const debordement = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', surTouche)
      document.body.style.overflow = debordement
    }
  }, [ouvert, onFermer])

  if (!ouvert) return null

  return (
    <div
      className={styles.voile}
      onMouseDown={(evenement) => {
        if (evenement.target === evenement.currentTarget) onFermer()
      }}
    >
      <div
        className={`${styles.dialogue} ${large ? styles.large : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitre}
      >
        <header className={styles.entete}>
          <div>
            <h2 id={idTitre}>{titre}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button
            ref={refFermer}
            type="button"
            className="bouton bouton-icone"
            aria-label={fr.commun.fermer}
            onClick={onFermer}
          >
            ✕
          </button>
        </header>
        <div className={styles.corps}>{children}</div>
      </div>
    </div>
  )
}
