import type { EtapeDuJour } from '@leq/domaine'

import {
  chiffreRomain,
  compterReleves,
  destinationNoeud,
  etatAujourdhui,
  fermeLActe,
  ilYA,
  minutesDe,
  noteMax,
  positionDefi,
  rythmeDeFormule,
  surtitreFormat,
} from '@/services/rythme'

const ETAPE: NonNullable<EtapeDuJour['etape']> = {
  id: '11111111-1111-4111-8111-111111111111',
  ordre_global: 3,
  ordre: 3,
  statut: 'disponible',
  nombre_echecs: 0,
  rattrapage_propose: false,
  seuil_reussite: 18,
  nb_etapes_acte: 5,
}
const ACTE: NonNullable<EtapeDuJour['acte']> = {
  id: '22222222-2222-4222-8222-222222222222',
  ordre: 2,
  titre: 'Tenir sa ligne',
  sous_titre: 'Les crêtes du rythme',
}
const DEFI: NonNullable<EtapeDuJour['defi']> = {
  id: '33333333-3333-4333-8333-333333333333',
  cle: 'trois_phrases',
  format: 'standard',
  titre: 'Convaincs-moi en trois phrases',
  consigne: 'Défends une idée à laquelle tu crois.',
  focus: 'tes silences',
  plan: [],
  texte_a_lire: null,
  duree_lecture_s: null,
  duree_preparation_s: null,
  duree_max_s: 120,
  points: 25,
  competence: 'silences',
  provisoire: true,
}

function jour(surcharges: Partial<EtapeDuJour['rythme']> = {}, etape = ETAPE): EtapeDuJour {
  return {
    formule: 'gratuit',
    rythme: {
      jour: '2026-09-06',
      fuseau_horaire: 'Europe/Paris',
      etapes_validees_aujourdhui: 0,
      essais_aujourdhui: 0,
      limite_etapes: 1,
      limite_essais: 3,
      peut_enregistrer: true,
      raison: 'ok',
      ...surcharges,
    },
    etape,
    acte: ACTE,
    defi: DEFI,
  }
}

describe('etatAujourdhui', () => {
  it('offers the step when the rhythm allows it', () => {
    expect(etatAujourdhui(jour())).toEqual({ etat: 'defi', rattrapage: false })
  })

  it('sends to the short exercise first after two failures', () => {
    const j = jour({}, { ...ETAPE, nombre_echecs: 2, rattrapage_propose: true })
    expect(etatAujourdhui(j)).toEqual({ etat: 'defi', rattrapage: true })
  })

  it('maps every rhythm reason to its card', () => {
    expect(etatAujourdhui(jour({ peut_enregistrer: false, raison: 'limite_jour' }))).toEqual({
      etat: 'limite_jour',
    })
    expect(etatAujourdhui(jour({ peut_enregistrer: false, raison: 'limite_essais' }))).toEqual({
      etat: 'limite_essais',
    })
    expect(etatAujourdhui(jour({ peut_enregistrer: false, raison: 'parcours_termine' }))).toEqual({
      etat: 'parcours_termine',
    })
    expect(etatAujourdhui(jour({ peut_enregistrer: false, raison: 'aucune_etape' }))).toEqual({
      etat: 'aucune_etape',
    })
  })

  it('treats a missing step as no step even when the rhythm says ok', () => {
    const j = { ...jour(), etape: null, defi: null, acte: null }
    expect(etatAujourdhui(j)).toEqual({ etat: 'aucune_etape' })
  })
})

describe('the brief helpers', () => {
  it('numbers acts in roman numerals', () => {
    expect([1, 2, 3, 4].map(chiffreRomain)).toEqual(['I', 'II', 'III', 'IV'])
    expect(chiffreRomain(11)).toBe('11')
  })

  it('rounds durations up to whole minutes', () => {
    expect(minutesDe(120)).toBe(2)
    expect(minutesDe(170)).toBe(3)
    expect(minutesDe(30)).toBe(1)
  })

  it('writes the surtitre of the three formats as the mockup does', () => {
    expect(surtitreFormat('standard', 120)).toBe('Défi · 2 min')
    expect(surtitreFormat('texte', 180)).toBe('Défi texte · 3 min')
    expect(surtitreFormat('long', 300)).toBe('Grand format · 5 min')
  })

  it('places the défi in its act, and names the last one as the closing défi', () => {
    expect(positionDefi(ACTE, 3, 5)).toEqual({
      genre: 'courante',
      acte: 'II',
      titre: 'Les crêtes du rythme',
      ordre: 3,
      total: 5,
    })
    expect(positionDefi(ACTE, 5, 5)).toEqual({
      genre: 'derniere',
      acte: 'II',
      titre: 'Les crêtes du rythme',
    })
    expect(positionDefi({ ...ACTE, sous_titre: null }, 1, 1)).toEqual({
      genre: 'courante',
      acte: 'II',
      titre: 'Tenir sa ligne',
      ordre: 1,
      total: 1,
    })
  })

  it('reads the rhythm of a formula from its limit', () => {
    expect(rythmeDeFormule('gratuit', 1)).toBe('unParJour')
    expect(rythmeDeFormule('complet', 0)).toBe('sansLimite')
    expect(rythmeDeFormule('gratuit', 2)).toBe('plusieursParJour')
  })
})

describe('the map', () => {
  it('opens only the available node, the remediation first when proposed', () => {
    expect(destinationNoeud({ statut: 'verrouillee', rattrapage_propose: false })).toBe('aucune')
    expect(destinationNoeud({ statut: 'validee', rattrapage_propose: false })).toBe('aucune')
    expect(destinationNoeud({ statut: 'disponible', rattrapage_propose: false })).toBe('brief')
    expect(destinationNoeud({ statut: 'disponible', rattrapage_propose: true })).toBe('rattrapage')
  })

  it('counts validated steps over every act', () => {
    expect(
      compterReleves([
        { etapes: [{ statut: 'validee' }, { statut: 'validee' }] },
        { etapes: [{ statut: 'disponible' }, { statut: 'verrouillee' }] },
        { etapes: [] },
      ]),
    ).toEqual({ faits: 2, total: 4 })
  })

  it('says when a result happened, in French, through Intl', () => {
    const maintenant = new Date('2026-09-06T12:00:00Z')
    expect(ilYA('2026-09-06T08:00:00Z', maintenant)).toBe("aujourd'hui")
    expect(ilYA('2026-09-05T08:00:00Z', maintenant)).toBe('hier')
    expect(ilYA('2026-08-16T08:00:00Z', maintenant)).toBe('il y a 3 semaines')
    expect(ilYA('pas une date', maintenant)).toBe('')
  })
})

describe('the result', () => {
  it('sums the criteria maxima, or has no maximum without a grid', () => {
    expect(noteMax({ a: { score: 8, max: 10 }, b: { score: 9, max: 20 } })).toBe(30)
    expect(noteMax({})).toBeNull()
    expect(noteMax(null)).toBeNull()
    expect(noteMax('n/a')).toBeNull()
  })

  it('opens the traversed act only when this take validated the last step', () => {
    const base = {
      id: 't1',
      resultat: 'etape_validee' as const,
      etape: {
        ordre: 5,
        nb_etapes_acte: 5,
        tentative_validante_id: 't1',
        acte: { statut: 'traverse' },
      },
    }
    expect(fermeLActe(base)).toBe(true)
    expect(fermeLActe({ ...base, resultat: 'etape_echouee' })).toBe(false)
    expect(fermeLActe({ ...base, etape: { ...base.etape, ordre: 4 } })).toBe(false)
    expect(fermeLActe({ ...base, etape: { ...base.etape, tentative_validante_id: 't0' } })).toBe(
      false,
    )
    expect(fermeLActe({ ...base, etape: null })).toBe(false)
  })
})
