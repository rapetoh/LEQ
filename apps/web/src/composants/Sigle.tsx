import { fr } from '../fr'

/**
 * The brand mark. The file, not letters standing in for it: someone opening a duel link has
 * never seen LEQ before, and this is the whole of their first impression of it.
 */
export function Sigle({ hauteur = 28 }: { hauteur?: number }) {
  return (
    <img
      className="sigle"
      src="/marque/sigle-blanc.png"
      alt={fr.app.nom}
      style={{ height: hauteur }}
    />
  )
}
