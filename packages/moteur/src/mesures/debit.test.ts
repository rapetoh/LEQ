import { describe, expect, it } from 'vitest'
import type { MotTranscrit } from '../domaine.js'
import { mesurerDebit } from './debit.js'

/** n words spread evenly over [debut, fin). */
function motsReguliers(n: number, debut_s: number, fin_s: number): MotTranscrit[] {
  const pas = (fin_s - debut_s) / n
  return Array.from({ length: n }, (_, i) => ({
    mot: `m${i}`,
    debut_s: debut_s + i * pas,
    fin_s: debut_s + i * pas + pas * 0.6,
    confiance: 0.9,
  }))
}

describe('debit', () => {
  it('computes a steady rate with near-zero variation', () => {
    // 150 wpm for 40 s: 25 words per 10 s window
    const mots = motsReguliers(100, 0, 40)
    const mesure = mesurerDebit(mots, 40)
    expect(mesure.fenetres).toHaveLength(4)
    expect(mesure.fenetres.map((f) => f.mots_par_minute)).toEqual([150, 150, 150, 150])
    expect(mesure.fenetres[3]).toEqual({ debut_s: 30, fin_s: 40, mots_par_minute: 150 })
    // the last word ends before 40 s, so the global rate is slightly above 150
    expect(mesure.mots_par_minute).toBeGreaterThan(150)
    expect(mesure.mots_par_minute).toBeLessThan(153)
    expect(mesure.stabilite).toBe(0)
  })

  it('reports variation between slow and fast windows', () => {
    const mots = [...motsReguliers(20, 0, 10), ...motsReguliers(40, 10, 20)]
    const mesure = mesurerDebit(mots, 20)
    expect(mesure.fenetres.map((f) => f.mots_par_minute)).toEqual([120, 240])
    // population CV of [120, 240] = 60 / 180
    expect(mesure.stabilite).toBeCloseTo(0.333, 3)
  })

  it('clips the last window and ignores tails shorter than 5 s for stability', () => {
    const mots = motsReguliers(30, 0, 12)
    const mesure = mesurerDebit(mots, 12)
    expect(mesure.fenetres).toHaveLength(2)
    expect(mesure.fenetres[1]).toEqual({ debut_s: 10, fin_s: 12, mots_par_minute: 150 })
    // only one window qualifies (the 2 s tail is dropped): null stability
    expect(mesure.stabilite).toBeNull()
  })

  it('excludes windows before speech starts from stability', () => {
    // silence for 20 s, then steady speech for 20 s
    const mots = motsReguliers(50, 20, 40)
    const mesure = mesurerDebit(mots, 40)
    expect(mesure.fenetres.map((f) => f.mots_par_minute)).toEqual([0, 0, 150, 150])
    expect(mesure.stabilite).toBe(0)
  })

  it('handles an empty transcript', () => {
    const mesure = mesurerDebit([], 15)
    expect(mesure.mots_par_minute).toBe(0)
    expect(mesure.stabilite).toBeNull()
    expect(mesure.fenetres.map((f) => f.mots_par_minute)).toEqual([0, 0])
  })
})
