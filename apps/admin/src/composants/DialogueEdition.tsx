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

  // `onFermer` is written inline at every call site, so it is a new function on every render.
  // Keeping it in a ref means the effect below runs when the dialog opens and closes, and not
  // on every re-render: it used to steal focus back to the close button each time the page
  // re-rendered, which put Enter on "close" while someone was typing.
  const refFermer_ = useRef(onFermer)
  useEffect(() => {
    refFermer_.current = onFermer
  })

  useEffect(() => {
    if (!ouvert) return
    refFermer.current?.focus()
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') refFermer_.current()
    }
    document.addEventListener('keydown', surTouche)
    // The page behind must not scroll under the dialog.
    const debordement = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', surTouche)
      document.body.style.overflow = debordement
    }
  }, [ouvert])

  if (!ouvert) return null

  return (
    <div
      className={styles.voile}
      // On the click, not on the press: starting a text selection inside the dialog and
      // releasing outside it used to count as dismissing, and took the whole form with it.
      onClick={(evenement) => {
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
