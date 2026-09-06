import styles from './Interrupteur.module.css'

type Props = {
  id?: string | undefined
  actif: boolean
  libelle: string
  disabled?: boolean | undefined
  onChange: (actif: boolean) => void
}

/** Accessible on/off switch (role="switch"); the label is read by screen readers only. */
export function Interrupteur({ id, actif, libelle, disabled, onChange }: Props) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={actif}
      aria-label={libelle}
      disabled={disabled ?? false}
      className={actif ? styles.actif : styles.inactif}
      onClick={() => onChange(!actif)}
    >
      <span className={styles.pouce} aria-hidden="true" />
    </button>
  )
}
