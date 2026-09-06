import { DefiEditableSchema } from '@leq/domaine'
import { describe, expect, it } from 'vitest'
import {
  grouperParActe,
  prochainOrdre,
  saisieDepuisDefi,
  saisieVierge,
  validerDefi,
  validerExercice,
  voisinPourEchange,
  type Defi,
  type ModeleActe,
} from './defis'

const ACTES: ModeleActe[] = [
  {
    ordre: 2,
    titre: 'Tenir sa ligne',
    sous_titre: 'Les crêtes du rythme',
    cree_le: '2026-09-06T00:00:00Z',
    modifie_le: '2026-09-06T00:00:00Z',
  },
  {
    ordre: 1,
    titre: 'Poser sa voix',
    sous_titre: null,
    cree_le: '2026-09-06T00:00:00Z',
    modifie_le: '2026-09-06T00:00:00Z',
  },
]

function defi(surcharges: Partial<Defi>): Defi {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    cle: 'premier_bonjour',
    ordre_acte: 1,
    ordre: 1,
    format: 'standard',
    titre: 'Le premier bonjour',
    consigne: 'Dis bonjour.',
    focus: 'ta voix',
    plan: [],
    texte_a_lire: null,
    duree_lecture_s: null,
    duree_preparation_s: null,
    duree_max_s: 120,
    points: 25,
    competence: 'voix',
    seuil_reussite: 18,
    provisoire: true,
    actif: true,
    cree_le: '2026-09-06T00:00:00Z',
    modifie_le: '2026-09-06T00:00:00Z',
    ...surcharges,
  }
}

describe('validerDefi', () => {
  it('accepts a complete standard défi and trims its texts', () => {
    const saisie = {
      ...saisieVierge(1, 3),
      cle: 'dire_bonjour',
      titre: ' Dire bonjour ',
      consigne: 'Dis-le.',
      competence: 'voix',
      seuil_reussite: '18,5',
    }
    const resultat = validerDefi(saisie)
    expect(resultat.ok).toBe(true)
    if (resultat.ok) {
      expect(resultat.valeur).toMatchObject({
        cle: 'dire_bonjour',
        titre: 'Dire bonjour',
        ordre_acte: 1,
        ordre: 3,
        duree_max_s: 120,
        seuil_reussite: 18.5,
        focus: null,
        texte_a_lire: null,
      })
    }
  })

  it('names every missing field', () => {
    const resultat = validerDefi(saisieVierge(1, 1))
    expect(resultat.ok).toBe(false)
    if (!resultat.ok) {
      expect(resultat.erreurs).toMatchObject({
        cle: 'requis',
        titre: 'requis',
        consigne: 'requis',
        competence: 'requis',
        seuil_reussite: 'requis',
      })
    }
  })

  it('refuses a key with capitals or spaces, and non-numbers', () => {
    const resultat = validerDefi({
      ...saisieVierge(1, 1),
      cle: 'Mon Défi',
      titre: 't',
      consigne: 'c',
      competence: 'x',
      seuil_reussite: 'dix',
      points: '1.5',
    })
    expect(resultat.ok).toBe(false)
    if (!resultat.ok)
      expect(resultat.erreurs).toMatchObject({
        cle: 'cle',
        seuil_reussite: 'nombre',
        points: 'entier',
      })
  })

  it('requires the text of a texte défi and the preparation of a long one', () => {
    const base = {
      ...saisieVierge(2, 1),
      cle: 'a',
      titre: 't',
      consigne: 'c',
      competence: 'x',
      seuil_reussite: '10',
    }
    const texte = validerDefi({ ...base, format: 'texte' })
    expect(texte.ok).toBe(false)
    if (!texte.ok)
      expect(texte.erreurs).toMatchObject({
        texte_a_lire: 'texteRequis',
        duree_lecture_s: 'requis',
      })
    const long = validerDefi({
      ...base,
      format: 'long',
      plan: [{ titre: '', detail: 'sans titre' }],
    })
    expect(long.ok).toBe(false)
    if (!long.ok)
      expect(long.erreurs).toMatchObject({
        duree_preparation_s: 'preparationRequise',
        plan: 'requis',
      })
  })

  it('drops the fields of other formats and empty plan lines', () => {
    const base = {
      ...saisieVierge(2, 1),
      cle: 'a',
      titre: 't',
      consigne: 'c',
      competence: 'x',
      seuil_reussite: '10',
    }
    const long = validerDefi({
      ...base,
      format: 'long',
      duree_preparation_s: '120',
      texte_a_lire: 'ignoré',
      duree_lecture_s: '40',
      plan: [
        { titre: 'Un', detail: '' },
        { titre: '', detail: '' },
      ],
    })
    expect(long.ok).toBe(true)
    if (long.ok)
      expect(long.valeur).toMatchObject({
        texte_a_lire: null,
        duree_lecture_s: null,
        duree_preparation_s: 120,
        plan: [{ titre: 'Un', detail: '' }],
      })
  })

  it('round-trips a défi through the form state', () => {
    const original = defi({
      format: 'texte',
      texte_a_lire: 'Un texte.',
      duree_lecture_s: 40,
      seuil_reussite: 12.5,
    })
    const resultat = validerDefi(saisieDepuisDefi(original))
    expect(resultat.ok).toBe(true)
    if (resultat.ok) expect(resultat.valeur).toEqual(DefiEditableSchema.parse(original))
  })
})

describe('validerExercice', () => {
  it('accepts a complete exercise and refuses an empty one', () => {
    expect(
      validerExercice({
        cle: 'compter',
        titre: 'Compter',
        consigne: 'Compte.',
        duree_s: '30',
        competence: 'silences',
        provisoire: true,
        actif: true,
      }),
    ).toMatchObject({ ok: true, valeur: { duree_s: 30 } })
    const vide = validerExercice({
      cle: '',
      titre: '',
      consigne: '',
      duree_s: '0',
      competence: '',
      provisoire: true,
      actif: true,
    })
    expect(vide.ok).toBe(false)
    if (!vide.ok) expect(vide.erreurs).toMatchObject({ cle: 'requis', duree_s: 'positif' })
  })
})

describe('the list', () => {
  const DEFIS = [
    defi({ id: 'b', cle: 'b', ordre_acte: 1, ordre: 2 }),
    defi({ id: 'c', cle: 'c', ordre_acte: 2, ordre: 1 }),
    defi({ id: 'a', cle: 'a', ordre_acte: 1, ordre: 1 }),
  ]

  it('groups défis under their act, both in order', () => {
    const groupes = grouperParActe(ACTES, DEFIS)
    expect(groupes.map((g) => g.acte.ordre)).toEqual([1, 2])
    expect(groupes[0]?.defis.map((d) => d.id)).toEqual(['a', 'b'])
    expect(groupes[1]?.defis.map((d) => d.id)).toEqual(['c'])
  })

  it('finds the neighbour to swap with inside the act, none at the edges', () => {
    expect(voisinPourEchange(DEFIS, 'a', 'bas')?.id).toBe('b')
    expect(voisinPourEchange(DEFIS, 'b', 'haut')?.id).toBe('a')
    expect(voisinPourEchange(DEFIS, 'a', 'haut')).toBeNull()
    expect(voisinPourEchange(DEFIS, 'b', 'bas')).toBeNull()
    expect(voisinPourEchange(DEFIS, 'inconnu', 'bas')).toBeNull()
  })

  it('gives the next free order in an act', () => {
    expect(prochainOrdre(DEFIS, 1)).toBe(3)
    expect(prochainOrdre(DEFIS, 3)).toBe(1)
  })
})
