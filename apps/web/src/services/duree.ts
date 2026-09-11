// Reading a duration out loud, and the share of the recording ring already gold.

/** "1:05", the way a timer is read. */
export function formaterDuree(secondes: number): string {
  const entier = Math.max(0, Math.floor(secondes))
  const minutes = Math.floor(entier / 60)
  return `${minutes}:${String(entier % 60).padStart(2, '0')}`
}

/** Share of the ring already filled, between 0 and 1. */
export function partAnneau(secondes: number, secondesMax: number): number {
  if (!Number.isFinite(secondesMax) || secondesMax <= 0) return 0
  return Math.min(1, Math.max(0, secondes / secondesMax))
}
