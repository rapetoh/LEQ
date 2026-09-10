// Geometry of the map of acts (H1): where the nodes sit inside the act's land and the winding
// path between them, as the mockup draws them (60, 250, 100, 250 on a 354 px wide land).

export type PointCarte = { x: number; y: number }

export const RAYON_NOEUD = 26
export const RAYON_COURANT = 37
const FRACTIONS = [0.17, 0.71, 0.28, 0.71] as const
const HAUT = 96
const PAS = 112

export function disposerNoeuds(nombre: number, largeur: number): PointCarte[] {
  return Array.from({ length: nombre }, (_v, i) => ({
    x: Math.round(largeur * (FRACTIONS[i % FRACTIONS.length] ?? 0.5)),
    y: HAUT + i * PAS,
  }))
}

/** Height of the land so the last label fits. */
export function hauteurCarte(nombre: number): number {
  return nombre === 0 ? 180 : HAUT + (nombre - 1) * PAS + 100
}

/** An SVG path through the points, S-curved like the mockup's. */
export function tracer(points: readonly PointCarte[]): string {
  const premier = points[0]
  if (!premier) return ''
  let d = `M ${premier.x} ${premier.y}`
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    if (!a || !b) continue
    const dy = b.y - a.y
    d += ` C ${a.x} ${a.y + dy * 0.6} ${b.x} ${b.y - dy * 0.6} ${b.x} ${b.y}`
  }
  return d
}
