/**
 * Speaking rate in words per minute.
 * - `mots_par_minute`: words over the spoken span (first word start to last word end),
 *   pauses included, which is what a listener perceives as pace.
 * - `fenetres`: fixed 10 s windows over the whole recording, a word belongs to the window
 *   that contains its start; the last window is clipped to the total duration.
 * - `stabilite`: coefficient of variation of the per-window rate over the windows that
 *   overlap the spoken span and last at least 5 s (short tails would distort it).
 *   Null with fewer than two such windows.
 */
import type { MotTranscrit } from '../domaine.js'
import { arrondir, arrondirNombre, coefficientVariation } from '../stats.js'

export const LARGEUR_FENETRE_S = 10
export const LARGEUR_MIN_FENETRE_STABILITE_S = 5

export interface FenetreDebit {
  debut_s: number
  fin_s: number
  mots_par_minute: number
}

export interface MesureDebit {
  mots_par_minute: number
  stabilite: number | null
  fenetres: FenetreDebit[]
}

export function mesurerDebit(mots: readonly MotTranscrit[], duree_totale_s: number): MesureDebit {
  const premier = mots[0]
  const dernier = mots[mots.length - 1]
  const finGrille = Math.max(duree_totale_s, dernier?.fin_s ?? 0)

  const fenetres: FenetreDebit[] = []
  const nbFenetres = Math.max(0, Math.ceil(finGrille / LARGEUR_FENETRE_S))
  const compte = new Array<number>(nbFenetres).fill(0)
  for (const mot of mots) {
    const index = Math.min(nbFenetres - 1, Math.floor(mot.debut_s / LARGEUR_FENETRE_S))
    if (index >= 0) compte[index] = (compte[index] as number) + 1
  }
  for (let i = 0; i < nbFenetres; i++) {
    const debut_s = i * LARGEUR_FENETRE_S
    const fin_s = Math.min(finGrille, debut_s + LARGEUR_FENETRE_S)
    const largeur = fin_s - debut_s
    fenetres.push({
      debut_s,
      fin_s: arrondirNombre(fin_s, 3),
      mots_par_minute: largeur > 0 ? arrondirNombre(((compte[i] as number) * 60) / largeur, 1) : 0,
    })
  }

  let mots_par_minute = 0
  let stabilite: number | null = null
  if (premier !== undefined && dernier !== undefined) {
    const etendue = dernier.fin_s - premier.debut_s
    mots_par_minute = etendue > 0 ? arrondirNombre((mots.length * 60) / etendue, 1) : 0
    const utiles = fenetres
      .filter((f) => f.fin_s > premier.debut_s && f.debut_s < dernier.fin_s)
      .filter((f) => f.fin_s - f.debut_s >= LARGEUR_MIN_FENETRE_STABILITE_S)
      .map((f) => f.mots_par_minute)
    stabilite = arrondir(coefficientVariation(utiles), 3)
  }

  return { mots_par_minute, stabilite, fenetres }
}
