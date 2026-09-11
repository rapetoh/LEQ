import type { CSSProperties } from 'react'

import { fr } from '../fr'
import { formaterDuree, partAnneau } from '../services/duree'

// The recording ring of the mockup: a gold arc filling as the seconds pass, the timer inside.

type Props = {
  secondes: number
  secondesMax: number
  enCours: boolean
}

export function AnneauMinuteur({ secondes, secondesMax, enCours }: Props) {
  const part = partAnneau(secondes, secondesMax)
  return (
    <div
      className="anneau"
      style={{ '--part': `${(part * 100).toFixed(2)}%` } as CSSProperties}
      role="timer"
      aria-label={fr.duel.tempsEcoule}
    >
      <div className="anneau-contenu">
        <span className="minuteur">{formaterDuree(secondes)}</span>
        {enCours ? <span className="point-rouge" aria-hidden="true" /> : null}
        <span className="petit">{fr.duel.surDuree(formaterDuree(secondesMax))}</span>
      </div>
    </div>
  )
}
