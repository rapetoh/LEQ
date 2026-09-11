import { FileLocale, type DependancesFile } from '@/services/file'
import type { EntreeFile } from '@/services/fileMachine'

function construire(options: { enLigne?: boolean; index?: EntreeFile[]; panne?: boolean } = {}) {
  let index: EntreeFile[] = options.index ?? []
  const supprimes: string[] = []
  const televerses: string[] = []
  let horloge = new Date('2026-09-06T10:00:00Z')
  const deps: DependancesFile = {
    lireIndex: async () => index,
    ecrireIndex: async (entrees) => {
      index = entrees
    },
    supprimerFichier: async (chemin) => {
      supprimes.push(chemin)
    },
    estEnLigne: async () => options.enLigne ?? true,
    televerser: async (entree) => {
      if (options.panne) throw new Error('panne réseau')
      televerses.push(entree.id)
    },
    maintenant: () => horloge,
    joursExpiration: () => 7,
  }
  return {
    file: new FileLocale(deps),
    lireIndex: () => index,
    supprimes,
    televerses,
    avancer: (ms: number) => {
      horloge = new Date(horloge.getTime() + ms)
    },
  }
}

const demarrage = {
  id: '1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a',
  type: 'diagnostic' as const,
  enregistre_le: new Date('2026-09-06T10:00:00Z'),
  fuseau_horaire: 'Europe/Paris',
  decalage_minutes: 120,
}

describe('FileLocale', () => {
  it('records, sends, deletes the file and keeps the entry as envoyée', async () => {
    const { file, supprimes, televerses, lireIndex } = construire()
    await file.charger()
    await file.commencer(demarrage)
    await file.terminer(demarrage.id, { chemin: '/cache/a.m4a', duree_s: 72 })
    const resultat = await file.envoyerEnAttente()
    expect(resultat).toEqual({ envoyees: 1, echecs: 0, horsLigne: false })
    expect(televerses).toEqual([demarrage.id])
    expect(supprimes).toEqual(['/cache/a.m4a'])
    expect(lireIndex()[0]?.etat).toBe('envoyee')
  })

  it('waits when offline and keeps the file', async () => {
    const { file, supprimes, televerses } = construire({ enLigne: false })
    await file.charger()
    await file.commencer(demarrage)
    await file.terminer(demarrage.id, { chemin: '/cache/a.m4a', duree_s: 72 })
    expect(await file.envoyerEnAttente()).toEqual({ envoyees: 0, echecs: 0, horsLigne: true })
    expect(televerses).toEqual([])
    expect(supprimes).toEqual([])
    expect(file.lire()[0]?.etat).toBe('en_attente_reseau')
  })

  it('backs off after a failure, then sends when the delay has passed', async () => {
    const { file, avancer, lireIndex } = construire({ panne: true })
    await file.charger()
    await file.commencer(demarrage)
    await file.terminer(demarrage.id, { chemin: '/cache/a.m4a', duree_s: 72 })
    expect(await file.envoyerEnAttente()).toEqual({ envoyees: 0, echecs: 1, horsLigne: false })
    expect(lireIndex()[0]?.derniere_erreur).toBe('panne réseau')
    expect(await file.envoyerEnAttente()).toEqual({ envoyees: 0, echecs: 0, horsLigne: false })
    avancer(31_000)
    expect((await file.envoyerEnAttente()).echecs).toBe(1)
  })

  it('repairs the index at startup: a take cut mid-recording is dropped with its file', async () => {
    const interrompue: EntreeFile = {
      id: demarrage.id,
      type: 'diagnostic',
      etape_id: null,
      duel_id: null,
      chemin: '/cache/a.m4a',
      enregistre_le: '2026-09-06T09:00:00Z',
      fuseau_horaire: 'Europe/Paris',
      decalage_minutes: 120,
      duree_s: null,
      etat: 'enregistrement',
      essais: 0,
      prochain_essai_a: null,
      derniere_erreur: null,
      termine_le: null,
    }
    const { file, supprimes } = construire({ index: [interrompue] })
    await file.charger()
    expect(file.lire()[0]?.etat).toBe('annulee')
    expect(supprimes).toEqual(['/cache/a.m4a'])
  })

  it('cancelling a waiting take deletes its file', async () => {
    const { file, supprimes } = construire()
    await file.charger()
    await file.commencer(demarrage)
    await file.terminer(demarrage.id, { chemin: '/cache/a.m4a', duree_s: 72 })
    await file.annuler(demarrage.id)
    expect(supprimes).toEqual(['/cache/a.m4a'])
    expect(file.lire()[0]?.etat).toBe('annulee')
  })
})
