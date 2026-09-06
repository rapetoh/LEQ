/** Small deterministic statistics helpers shared by the measure modules. */

export function moyenne(valeurs: readonly number[]): number | null {
  if (valeurs.length === 0) return null
  let somme = 0
  for (const v of valeurs) somme += v
  return somme / valeurs.length
}

/** Population standard deviation (divides by n), null on an empty input. */
export function ecartType(valeurs: readonly number[]): number | null {
  const m = moyenne(valeurs)
  if (m === null) return null
  let somme = 0
  for (const v of valeurs) somme += (v - m) * (v - m)
  return Math.sqrt(somme / valeurs.length)
}

/** Coefficient of variation (std / mean), null when the mean is 0 or fewer than 2 values. */
export function coefficientVariation(valeurs: readonly number[]): number | null {
  if (valeurs.length < 2) return null
  const m = moyenne(valeurs)
  const s = ecartType(valeurs)
  if (m === null || s === null || m === 0) return null
  return s / m
}

export function mediane(valeurs: readonly number[]): number | null {
  if (valeurs.length === 0) return null
  const tri = [...valeurs].sort((a, b) => a - b)
  const milieu = Math.floor(tri.length / 2)
  if (tri.length % 2 === 1) return tri[milieu] as number
  return ((tri[milieu - 1] as number) + (tri[milieu] as number)) / 2
}

/** Linear-interpolated percentile, p in [0, 100]. */
export function percentile(valeurs: readonly number[], p: number): number | null {
  if (valeurs.length === 0) return null
  const tri = [...valeurs].sort((a, b) => a - b)
  const rang = (p / 100) * (tri.length - 1)
  const bas = Math.floor(rang)
  const haut = Math.ceil(rang)
  const poids = rang - bas
  return (tri[bas] as number) * (1 - poids) + (tri[haut] as number) * poids
}

export function maximum(valeurs: readonly number[]): number | null {
  if (valeurs.length === 0) return null
  let m = -Infinity
  for (const v of valeurs) if (v > m) m = v
  return m
}

/** Round to a fixed number of decimals, keeping null. */
export function arrondir(valeur: number | null, decimales: number): number | null {
  if (valeur === null || !Number.isFinite(valeur)) return null
  const facteur = 10 ** decimales
  return Math.round(valeur * facteur) / facteur
}

/** Same as `arrondir` for values that are never null. */
export function arrondirNombre(valeur: number, decimales: number): number {
  const facteur = 10 ** decimales
  return Math.round(valeur * facteur) / facteur
}

/** RMS of a slice of samples, in dBFS. Digital silence is floored at -100 dB. */
export function dbfs(echantillons: Float32Array, debut: number, fin: number): number {
  const n = fin - debut
  if (n <= 0) return -100
  let somme = 0
  for (let i = debut; i < fin; i++) {
    const v = echantillons[i] as number
    somme += v * v
  }
  const rms = Math.sqrt(somme / n)
  if (rms <= 0) return -100
  return Math.max(-100, 20 * Math.log10(rms))
}
