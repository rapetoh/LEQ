import { useCallback, useRef, useState, type ReactNode } from 'react'
import { fr } from '../fr'
import { ToastContext, type Notifier, type Toast } from './toastContext'
import styles from './Toasts.module.css'

const DUREE_SUCCES_MS = 4000
const DUREE_ERREUR_MS = 8000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const compteur = useRef(0)

  const retirer = useCallback((id: number) => {
    setToasts((liste) => liste.filter((toast) => toast.id !== id))
  }, [])

  const notifier = useCallback<Notifier>(
    (toast) => {
      compteur.current += 1
      const id = compteur.current
      setToasts((liste) => [...liste, { ...toast, id }])
      window.setTimeout(
        () => retirer(id),
        toast.type === 'erreur' ? DUREE_ERREUR_MS : DUREE_SUCCES_MS,
      )
    },
    [retirer],
  )

  return (
    <ToastContext.Provider value={notifier}>
      {children}
      <div className={styles.zone} role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={toast.type === 'erreur' ? styles.toastErreur : styles.toastSucces}
          >
            <div className={styles.corps}>
              <p className={styles.message}>{toast.message}</p>
              {toast.details ? <p className={styles.details}>{toast.details}</p> : null}
            </div>
            <button
              type="button"
              className={styles.fermer}
              onClick={() => retirer(toast.id)}
              aria-label={fr.commun.fermer}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
