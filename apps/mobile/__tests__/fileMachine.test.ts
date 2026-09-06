import {
  aEnvoyer,
  abandonnerEnregistrementInterrompu,
  annuler,
  creerEntree,
  delaiAvantEssaiS,
  estExpiree,
  expirer,
  marquerEchecEnvoi,
  marquerEnvoi,
  marquerEnvoyee,
  nettoyer,
  reprendreEnvoiInterrompu,
  terminerEnregistrement,
} from '@/services/fileMachine'

const t0 = new Date('2026-09-06T10:00:00Z')
const demarrage = {
  id: '1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a',
  type: 'diagnostic' as const,
  enregistre_le: t0,
  fuseau_horaire: 'Europe/Paris',
  decalage_minutes: 120,
}

describe('fileMachine', () => {
  it('walks the happy path: enregistrement, en attente réseau, envoi, envoyée', () => {
    let e = creerEntree(demarrage)
    expect(e.etat).toBe('enregistrement')
    e = terminerEnregistrement(e, { chemin: '/cache/a.m4a', duree_s: 72 })
    expect(e.etat).toBe('en_attente_reseau')
    expect(aEnvoyer([e], t0)).toHaveLength(1)
    e = marquerEnvoi(e)
    e = marquerEnvoyee(e, t0)
    expect(e.etat).toBe('envoyee')
    expect(e.chemin).toBeNull()
  })

  it('refuses impossible transitions', () => {
    const e = creerEntree(demarrage)
    expect(() => marquerEnvoi(e)).toThrow()
    expect(() => marquerEnvoyee(e, t0)).toThrow()
  })

  it('backs off after a failed send and keeps the file', () => {
    let e = marquerEnvoi(
      terminerEnregistrement(creerEntree(demarrage), { chemin: '/cache/a.m4a', duree_s: 72 }),
    )
    e = marquerEchecEnvoi(e, 'réseau coupé', t0)
    expect(e.etat).toBe('en_attente_reseau')
    expect(e.essais).toBe(1)
    expect(e.chemin).toBe('/cache/a.m4a')
    expect(aEnvoyer([e], t0)).toHaveLength(0)
    expect(aEnvoyer([e], new Date(t0.getTime() + 31_000))).toHaveLength(1)
    expect([0, 1, 2, 3, 4, 5, 6].map(delaiAvantEssaiS)).toEqual([30, 60, 120, 240, 480, 900, 900])
  })

  it('drops a take interrupted mid-recording and resumes an interrupted send', () => {
    const interrompue = abandonnerEnregistrementInterrompu(creerEntree(demarrage), t0)
    expect(interrompue.etat).toBe('annulee')
    const envoi = marquerEnvoi(
      terminerEnregistrement(creerEntree(demarrage), { chemin: '/cache/a.m4a', duree_s: 72 }),
    )
    expect(reprendreEnvoiInterrompu(envoi).etat).toBe('en_attente_reseau')
  })

  it('expires a waiting take after the configured number of days', () => {
    const e = terminerEnregistrement(creerEntree(demarrage), {
      chemin: '/cache/a.m4a',
      duree_s: 72,
    })
    expect(estExpiree(e, new Date(t0.getTime() + 6 * 86_400_000), 7)).toBe(false)
    expect(estExpiree(e, new Date(t0.getTime() + 7 * 86_400_000), 7)).toBe(true)
    expect(expirer(e, t0).etat).toBe('expiree')
  })

  it('cleans terminal entries after a day and keeps the rest', () => {
    const envoyee = marquerEnvoyee(
      marquerEnvoi(terminerEnregistrement(creerEntree(demarrage), { chemin: '/c', duree_s: 1 })),
      t0,
    )
    const annulee = annuler(
      creerEntree({ ...demarrage, id: '2b2b2b2b-2b2b-4b2b-8b2b-2b2b2b2b2b2b' }),
      t0,
    )
    const attente = terminerEnregistrement(
      creerEntree({ ...demarrage, id: '3c3c3c3c-3c3c-4c3c-8c3c-3c3c3c3c3c3c' }),
      { chemin: '/d', duree_s: 1 },
    )
    const plusTard = new Date(t0.getTime() + 25 * 3_600_000)
    expect(nettoyer([envoyee, annulee, attente], t0)).toHaveLength(3)
    expect(nettoyer([envoyee, annulee, attente], plusTard).map((e) => e.id)).toEqual([attente.id])
  })
})
