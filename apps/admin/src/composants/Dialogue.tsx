import { useEffect, useId, useRef } from 'react'
import styles from './Dialogue.module.css'

type Props = {
  ouvert: boolean
  titre: string
  message: string
  libelleConfirmer: string
  libelleAnnuler: string
  onConfirmer: () => void
  onAnnuler: () => void
}

/**
 * Confirmation dialog. Built with plain elements rather than <dialog> so it behaves the same in
 * jsdom and in browsers; focus lands on the cancel button, Escape and the backdrop cancel.
 */
export function DialogueConfirmation({
  ouvert,
  titre,
  message,
  libelleConfirmer,
  libelleAnnuler,
  onConfirmer,
  onAnnuler,
}: Props) {
  const idTitre = useId()
  const idMessage = useId()
  const refAnnuler = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!ouvert) return
    refAnnuler.current?.focus()

    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') onAnnuler()
    }
    document.addEventListener('keydown', surTouche)
    return () => document.removeEventListener('keydown', surTouche)
  }, [ouvert, onAnnuler])

  if (!ouvert) return null

  return (
    <div className={styles.voile} onClick={onAnnuler}>
      <div
        className={styles.boite}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitre}
        aria-describedby={idMessage}
        onClick={(evenement) => evenement.stopPropagation()}
      >
        <h2 id={idTitre}>{titre}</h2>
        <p id={idMessage} className={styles.message}>
          {message}
        </p>
        <div className={styles.actions}>
          <button
            ref={refAnnuler}
            type="button"
            className="bouton bouton-secondaire"
            onClick={onAnnuler}
          >
            {libelleAnnuler}
          </button>
          <button type="button" className="bouton bouton-principal" onClick={onConfirmer}>
            {libelleConfirmer}
          </button>
        </div>
      </div>
    </div>
  )
}
