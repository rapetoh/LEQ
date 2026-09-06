import { describe, expect, it } from 'vitest'
import { lireChargeJob, cleIdempotenceAnalyser, delaiAvantNouvelEssaiS } from './jobs.js'
import { lireRoleDepuisAppMetadata } from './profil.js'
import {
  cheminAudioTentative,
  estDateEnregistrementPlausible,
  estStatutTentativeFinal,
  NouvelleTentativeSchema,
} from './tentative.js'

const utilisateur = '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f'
const tentative = '1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a'

describe('NouvelleTentativeSchema', () => {
  const base = {
    id: tentative,
    utilisateur_id: utilisateur,
    type: 'diagnostic',
    enregistre_le: '2026-09-06T10:00:00+02:00',
    fuseau_horaire: 'Europe/Paris',
    decalage_minutes: 120,
    chemin_audio: cheminAudioTentative(utilisateur, tentative),
  }

  it('accepts the phone payload and fills the defaults', () => {
    const resultat = NouvelleTentativeSchema.parse(base)
    expect(resultat.statut).toBe('envoyee')
    expect(resultat.etape_id).toBeNull()
    expect(resultat.chemin_audio).toBe(`${utilisateur}/${tentative}.m4a`)
  })

  it('refuses an audio path that does not follow {utilisateur_id}/{id}.m4a', () => {
    expect(
      NouvelleTentativeSchema.safeParse({ ...base, chemin_audio: 'ailleurs.m4a' }).success,
    ).toBe(false)
  })

  it('refuses a status other than envoyee and an implausible offset', () => {
    expect(NouvelleTentativeSchema.safeParse({ ...base, statut: 'en_mesure' }).success).toBe(false)
    expect(NouvelleTentativeSchema.safeParse({ ...base, decalage_minutes: 900 }).success).toBe(
      false,
    )
  })
})

describe('estDateEnregistrementPlausible', () => {
  const maintenant = new Date('2026-09-06T12:00:00Z')
  it('accepts now, a few minutes ahead and up to eight days back', () => {
    expect(estDateEnregistrementPlausible(maintenant, maintenant)).toBe(true)
    expect(estDateEnregistrementPlausible(new Date('2026-09-06T12:04:00Z'), maintenant)).toBe(true)
    expect(estDateEnregistrementPlausible(new Date('2026-08-30T12:00:00Z'), maintenant)).toBe(true)
  })
  it('refuses the far future, the distant past and garbage', () => {
    expect(estDateEnregistrementPlausible(new Date('2026-09-06T12:06:00Z'), maintenant)).toBe(false)
    expect(estDateEnregistrementPlausible(new Date('2026-08-01T12:00:00Z'), maintenant)).toBe(false)
    expect(estDateEnregistrementPlausible('pas une date', maintenant)).toBe(false)
  })
})

describe('statuts', () => {
  it('knows the final states', () => {
    expect(estStatutTentativeFinal('retour_disponible')).toBe(true)
    expect(estStatutTentativeFinal('en_mesure')).toBe(false)
  })
})

describe('jobs', () => {
  it('types the charge by job type and rejects a wrong charge', () => {
    expect(lireChargeJob('analyser_tentative', { tentative_id: tentative })).toEqual({
      tentative_id: tentative,
    })
    expect(() => lireChargeJob('analyser_tentative', {})).toThrow()
    expect(cleIdempotenceAnalyser(tentative)).toBe(`analyser:${tentative}`)
  })
  it('doubles the retry delay', () => {
    expect(delaiAvantNouvelEssaiS(0)).toBe(30)
    expect(delaiAvantNouvelEssaiS(3)).toBe(240)
  })
})

describe('lireRoleDepuisAppMetadata', () => {
  it('reads admin and defaults to utilisateur', () => {
    expect(lireRoleDepuisAppMetadata({ role: 'admin' })).toBe('admin')
    expect(lireRoleDepuisAppMetadata({ role: 'superuser' })).toBe('utilisateur')
    expect(lireRoleDepuisAppMetadata(null)).toBe('utilisateur')
  })
})
