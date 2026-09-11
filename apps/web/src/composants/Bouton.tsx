// Buttons are verbs (decision 17). Three weights, one width: the thumb's.

type Props = {
  libelle: string
  onClick: () => void
  variante?: 'principal' | 'secondaire' | 'texte'
  chargement?: boolean
  desactive?: boolean
  type?: 'button' | 'submit'
}

export function Bouton({
  libelle,
  onClick,
  variante = 'principal',
  chargement = false,
  desactive = false,
  type = 'button',
}: Props) {
  return (
    <button
      type={type}
      className={`bouton bouton-${variante}`}
      onClick={onClick}
      disabled={desactive || chargement}
      aria-busy={chargement || undefined}
    >
      {libelle}
    </button>
  )
}
