import { pino } from 'pino'
import { describe, expect, it, vi } from 'vitest'

import type { Executeur } from '../db.js'
import { AdversaireStub } from '../debat/fournisseurs.js'
import { creerHandlerDebrieferDebat } from './debrieferDebat.js'

const log = pino({ level: 'silent' })
const contexte = { log, dernierEssai: false }
const DEBAT = '11111111-1111-4111-8111-111111111111'
const job = { id: 1, type: 'debriefer_debat', charge: { debat_id: DEBAT } } as never

function reponse(rows: unknown[]) {
  return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] } as never
}

/** A database that holds one debate with two turns and no note yet. */
function depot(options: { fait?: boolean; tours?: unknown[]; existe?: boolean } = {}) {
  const ecrits: Array<{ moments: unknown; axe: unknown; provisoire: unknown }> = []
  const lues: string[] = []
  const ex: Executeur = {
    async query(text: string, values?: unknown[]) {
      lues.push(text)
      if (text.includes('debrief is not null')) return reponse([{ fait: options.fait === true }])
      if (text.includes('these_texte, ton_adversaire')) {
        return options.existe === false
          ? reponse([])
          : reponse([{ these_texte: 'Le mérite est un mythe.', ton_adversaire: 'ferme' }])
      }
      if (text.includes('from public.tours_debat')) {
        return reponse(
          options.tours ?? [
            { numero: 1, locuteur: 'utilisateur', texte: 'Le hasard fait beaucoup.' },
            { numero: 2, locuteur: 'retor', texte: 'Beaucoup, mais pas tout.' },
          ],
        )
      }
      if (text.includes('set debrief')) {
        ecrits.push({ moments: values?.[1], axe: values?.[2], provisoire: values?.[3] })
        return reponse([])
      }
      throw new Error(`requête inattendue: ${text}`)
    },
  }
  return { ex, ecrits, lues }
}

describe('debriefer_debat', () => {
  it('writes the note from the written transcript, never from audio', async () => {
    const { ex, ecrits, lues } = depot()
    // An opponent that quotes what it was given, so the assertion is about what the job hands
    // over and not about whatever the stub happens to answer.
    const adversaire = new AdversaireStub()
    vi.spyOn(adversaire, 'debriefer').mockImplementation(async (contexteDebrief) => ({
      moments: contexteDebrief.tours
        .filter((t) => t.locuteur === 'utilisateur')
        .map((t) => t.texte),
      axe: 'Travaille tes silences.',
      provisoire: false,
    }))
    await creerHandlerDebrieferDebat({ ex, adversaire })(job, contexte)
    expect(ecrits).toHaveLength(1)
    expect(JSON.parse(String(ecrits[0]?.moments))).toEqual(['Le hasard fait beaucoup.'])
    // Nothing in the chain ever reaches for a recording, because there is none.
    expect(lues.some((requete) => /audio|chemin/i.test(requete))).toBe(false)
  })

  // A debriefing written by the stub must say so, or E4 shows an empty note as if it were the
  // real one.
  it('marque provisoire un débriefing écrit par le bouchon', async () => {
    const { ex, ecrits } = depot()
    await creerHandlerDebrieferDebat({ ex, adversaire: new AdversaireStub() })(job, contexte)
    expect(ecrits[0]?.provisoire).toBe(true)
    expect(JSON.parse(String(ecrits[0]?.moments))).toEqual([])
  })

  it('leaves a debate that already has its note alone', async () => {
    const { ex, ecrits } = depot({ fait: true })
    await creerHandlerDebrieferDebat({ ex, adversaire: new AdversaireStub() })(job, contexte)
    expect(ecrits).toEqual([])
  })

  it('writes an empty note for a debate where nobody said anything', async () => {
    // The screen reads "no note" as "still being written" and polls for it. An empty note is
    // what tells it there is nothing coming.
    const { ex, ecrits } = depot({ tours: [] })
    await creerHandlerDebrieferDebat({ ex, adversaire: new AdversaireStub() })(job, contexte)
    expect(ecrits).toHaveLength(1)
    expect(JSON.parse(String(ecrits[0]?.moments))).toEqual([])
  })

  it('writes nothing for a debate that is gone', async () => {
    const { ex, ecrits } = depot({ existe: false })
    await creerHandlerDebrieferDebat({ ex, adversaire: new AdversaireStub() })(job, contexte)
    expect(ecrits).toEqual([])
  })

  it('refuses a charge without a debate rather than debriefing at random', async () => {
    const { ex } = depot()
    await expect(
      creerHandlerDebrieferDebat({ ex, adversaire: new AdversaireStub() })(
        { id: 2, type: 'debriefer_debat', charge: {} } as never,
        contexte,
      ),
    ).rejects.toThrow(/debriefer_debat/)
  })
})
