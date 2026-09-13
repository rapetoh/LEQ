import { describe, expect, it } from 'vitest'
import {
  saisieCritereVierge,
  saisieDepuisCritere,
  validerCritere,
  type CritereGrille,
} from './grille'

const BASE = {
  ...saisieCritereVierge(),
  cle: 'silence_tenu',
  nom: 'Le silence tenu',
  definition: 'Au moins un silence d’une seconde avant une idée forte.',
  score_max: '10',
  elements: [
    {
      mesure: 'silences.tenus',
      poids: '1',
      bandes: [
        { min: '', max: '1', score: '0' },
        { min: '1', max: '3', score: '6' },
        { min: '3', max: '', score: '10' },
      ],
    },
  ],
}

describe('validerCritere', () => {
  it('builds a rule v1 from the form', () => {
    const resultat = validerCritere(BASE, 2)
    expect(resultat.ok).toBe(true)
    if (resultat.ok) {
      expect(resultat.valeur).toMatchObject({
        cle: 'silence_tenu',
        ordre: 2,
        regle: {
          version: 1,
          score_max: 10,
          elements: [
            {
              mesure: 'silences.tenus',
              poids: 1,
              bandes: [
                { min: null, max: 1, score: 0 },
                { min: 1, max: 3, score: 6 },
                { min: 3, max: null, score: 10 },
              ],
            },
          ],
        },
      })
    }
  })

  it('names every field in error, bands included', () => {
    const resultat = validerCritere(
      {
        ...BASE,
        cle: 'Silence Tenu',
        score_max: '0',
        elements: [{ mesure: '', poids: '-1', bandes: [{ min: '5', max: '2', score: 'x' }] }],
      },
      1,
    )
    expect(resultat.ok).toBe(false)
    if (!resultat.ok) {
      expect(resultat.erreurs).toMatchObject({
        cle: 'cle',
        score_max: 'positif',
        'elements.0.mesure': 'requis',
        'elements.0.poids': 'positif',
        'elements.0.bandes.0.max': 'bande',
        'elements.0.bandes.0.score': 'nombre',
      })
    }
  })

  it('accepts a French comma and a per-word crutch path', () => {
    const resultat = validerCritere(
      {
        ...BASE,
        score_max: '7,5',
        elements: [
          {
            mesure: 'mots_bequilles.par_type.euh',
            poids: '2',
            bandes: [{ min: '', max: '', score: '1' }],
          },
        ],
      },
      1,
    )
    expect(resultat.ok).toBe(true)
    if (resultat.ok) expect(resultat.valeur.regle.score_max).toBe(7.5)
  })

  it('round-trips a criterion through the form state', () => {
    const critere: CritereGrille = {
      id: '00000000-0000-4000-8000-000000000001',
      grille_id: '00000000-0000-4000-8000-000000000002',
      cle: 'debit',
      nom: 'Le débit',
      definition: 'Entre 130 et 150 mots par minute.',
      source: 'mesure',
      exemple_cinq: null,
      exemple_deux: null,
      regle: {
        version: 1,
        score_max: 10,
        elements: [
          {
            mesure: 'debit.mots_par_minute',
            poids: 1,
            bandes: [{ min: 130, max: 150.5, score: 10 }],
          },
        ],
      },
      ordre: 1,
      cree_le: '2026-09-06T00:00:00Z',
      modifie_le: '2026-09-06T00:00:00Z',
    }
    const resultat = validerCritere(saisieDepuisCritere(critere), 1)
    expect(resultat.ok).toBe(true)
    if (resultat.ok) expect(resultat.valeur.regle).toEqual(critere.regle)
  })
})

// Chapter 5, rewritten 12 September 2026: two of the six axes are judged and not measured, and
// what holds a judged axis in place is the pair of worked examples.
describe('un axe jugé', () => {
  const jugé = {
    cle: 'structure',
    nom: 'La structure du propos',
    definition: 'Une entrée, un développement, une sortie.',
    source: 'jugement' as const,
    score_max: '5',
    exemple_cinq: "Elle annonce son plan, le tient, et conclut sur ce qu'elle a promis.",
    exemple_deux: 'Elle part dans trois directions et ne revient sur aucune.',
    elements: [],
  }

  it('se valide sans bandes, puisque rien ne se calcule', () => {
    const resultat = validerCritere(jugé, 2)
    expect(resultat.ok).toBe(true)
    if (resultat.ok) {
      expect(resultat.valeur.source).toBe('jugement')
      expect(resultat.valeur.regle.elements).toEqual([])
      expect(resultat.valeur.exemple_cinq).toContain('annonce son plan')
    }
  })

  it('refuse de partir sans ses deux exemples', () => {
    const resultat = validerCritere({ ...jugé, exemple_deux: '  ' }, 2)
    expect(resultat.ok).toBe(false)
    if (!resultat.ok) expect(resultat.erreurs.exemple_deux).toBe('requis')
  })
})
