import { describe, expect, it } from 'vitest'
import { composerNote, partNormalisee } from './evaluation.js'

// Chapter 5, rewritten after the meeting of 12 September 2026: four axes measured, two judged,
// and the split between them a setting rather than an accident of how many axes are in each group.
describe('composerNote', () => {
  it('pondère les deux moitiés comme le réglage le dit', () => {
    expect(
      composerNote({ mesure: 1, jugement: 0, poidsMesure: 0.65, poidsJugement: 0.35, noteMax: 30 }),
    ).toBe(19.5)
    expect(
      composerNote({ mesure: 0, jugement: 1, poidsMesure: 0.65, poidsJugement: 0.35, noteMax: 30 }),
    ).toBe(10.5)
    expect(
      composerNote({ mesure: 1, jugement: 1, poidsMesure: 0.65, poidsJugement: 0.35, noteMax: 30 }),
    ).toBe(30)
  })

  // A note out of thirty that silently became a note out of twenty would fail every threshold for
  // a reason nobody could see.
  it("donne toute la note à la moitié présente quand l'autre n'a aucun axe", () => {
    expect(
      composerNote({
        mesure: 0.6,
        jugement: null,
        poidsMesure: 0.65,
        poidsJugement: 0.35,
        noteMax: 30,
      }),
    ).toBe(18)
    expect(
      composerNote({
        mesure: null,
        jugement: null,
        poidsMesure: 0.65,
        poidsJugement: 0.35,
        noteMax: 30,
      }),
    ).toBeNull()
  })

  it('ramène une moitié entre 0 et 1 sur ses seuls axes', () => {
    const sousNotes = {
      debit: { score: 4, max: 5 },
      bequilles: { score: 3, max: 5 },
      structure: { score: 1, max: 5 },
    }
    expect(partNormalisee(sousNotes, ['debit', 'bequilles'])).toBeCloseTo(0.7)
    expect(partNormalisee(sousNotes, ['structure'])).toBeCloseTo(0.2)
    expect(partNormalisee(sousNotes, ['inconnu'])).toBeNull()
  })
})
