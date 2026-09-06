import { describe, expect, it } from 'vitest'
import { EtapeDuJourSchema } from './parcours.js'

describe('EtapeDuJourSchema', () => {
  it('parses the answer of etape_du_jour() with a step and without one', () => {
    const avec = EtapeDuJourSchema.parse({
      formule: 'gratuit',
      rythme: {
        jour: '2026-09-06',
        fuseau_horaire: 'Europe/Paris',
        etapes_validees_aujourdhui: 0,
        essais_aujourdhui: 1,
        limite_etapes: 1,
        limite_essais: 3,
        peut_enregistrer: true,
        raison: 'ok',
      },
      etape: {
        id: '1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a',
        ordre_global: 1,
        ordre: 1,
        statut: 'disponible',
        nombre_echecs: 0,
        rattrapage_propose: false,
        seuil_reussite: '18.00',
        nb_etapes_acte: 7,
      },
      acte: {
        id: '2b2b2b2b-2b2b-4b2b-8b2b-2b2b2b2b2b2b',
        ordre: 1,
        titre: 'Poser sa voix',
        sous_titre: null,
      },
      defi: {
        id: '3c3c3c3c-3c3c-4c3c-8c3c-3c3c3c3c3c3c',
        cle: 'premier_bonjour',
        format: 'standard',
        titre: 'Le premier bonjour',
        consigne: 'Dis bonjour.',
        focus: 'ton temps avant de démarrer',
        plan: [],
        texte_a_lire: null,
        duree_lecture_s: null,
        duree_preparation_s: null,
        duree_max_s: 60,
        points: 25,
        competence: 'demarrage',
        provisoire: true,
      },
    })
    expect(avec.etape?.seuil_reussite).toBe(18)
    const sans = EtapeDuJourSchema.parse({
      formule: 'complet',
      rythme: {
        jour: '2026-09-06',
        fuseau_horaire: 'Europe/Paris',
        etapes_validees_aujourdhui: 0,
        essais_aujourdhui: 0,
        limite_etapes: 0,
        limite_essais: 3,
        peut_enregistrer: false,
        raison: 'parcours_termine',
      },
      etape: null,
      acte: null,
      defi: null,
    })
    expect(sans.rythme.raison).toBe('parcours_termine')
  })
})
