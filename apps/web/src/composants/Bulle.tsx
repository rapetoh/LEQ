import { fr } from '../fr'

// Bulle, the mascot, with the mockup's geometry: a speech bubble in "or" 130 x 96 with a radius
// of 36, a tail at the bottom left, two eyes 11 x 17, and a mouth that speaks, smiles or waits.
// Same numbers as apps/mobile/src/components/Bulle.tsx, drawn here in SVG.

export type VisageBulle = 'parle' | 'sourit' | 'attend'

type Props = {
  /** Width in pixels. The mockup uses 52, 96 and 150. */
  taille?: number
  visage?: VisageBulle
  /** Bulle listens without moving. Reduced motion is also honoured by the stylesheet. */
  calme?: boolean
}

const BASE_L = 150
const BASE_H = 134
const NUIT = '#001636'
const OR = '#ffbd59'

export function Bulle({ taille = 96, visage = 'parle', calme = false }: Props) {
  const barres = [56, 63.5, 71, 78.5]
  return (
    <svg
      width={taille}
      height={(taille * BASE_H) / BASE_L}
      viewBox={`0 0 ${BASE_L} ${BASE_H}`}
      role="img"
      aria-label={fr.commun.bulle}
      className={calme ? undefined : 'bulle-flotte'}
    >
      <rect x="10" y="10" width="130" height="96" rx="36" fill={OR} />
      <polygon points="38,98 64,98 44,124" fill={OR} />
      <rect x="44" y="40" width="11" height="17" rx="6" fill={NUIT} />
      <rect x="90" y="40" width="11" height="17" rx="6" fill={NUIT} />

      {visage === 'parle' ? (
        barres.map((x) => (
          <rect
            key={x}
            x={x}
            y="70"
            width="4.5"
            height="17"
            rx="2"
            fill={NUIT}
            className={calme ? undefined : 'barre-parle'}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          />
        ))
      ) : visage === 'sourit' ? (
        <path
          d="M 60 69 Q 68.5 80 77 69"
          fill="none"
          stroke={NUIT}
          strokeWidth="4"
          strokeLinecap="round"
        />
      ) : (
        <path d="M 55 72 H 86 A 15.5 14 0 0 1 55 72 Z" fill={NUIT} />
      )}
    </svg>
  )
}
