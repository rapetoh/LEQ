import { createContext, useContext } from 'react'

export type Toast = {
  id: number
  type: 'succes' | 'erreur'
  message: string
  /** Technical detail shown smaller, for example the database error message. */
  details?: string
}

export type Notifier = (toast: Omit<Toast, 'id'>) => void

export const ToastContext = createContext<Notifier | null>(null)

export function useNotifier(): Notifier {
  const notifier = useContext(ToastContext)
  if (!notifier) {
    throw new Error('useNotifier doit être appelé sous ToastProvider.')
  }
  return notifier
}
