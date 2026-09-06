import { readFile } from 'node:fs/promises'
import path from 'node:path'

export interface EntreeCorpus {
  id: string
  source: string
  accent: string
  debit: string
  bruit: string
  duree_s: number
  consentement: string
}

export interface Enregistrement extends EntreeCorpus {
  audio: Uint8Array
  reference: string
}

function estEntree(v: unknown): v is EntreeCorpus {
  if (v === null || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o['id'] === 'string' &&
    typeof o['accent'] === 'string' &&
    typeof o['debit'] === 'string' &&
    typeof o['bruit'] === 'string' &&
    typeof o['duree_s'] === 'number'
  )
}

/** Reads metadata.json plus every <id>.wav and <id>.txt of the corpus directory. */
export async function chargerCorpus(dossier: string): Promise<Enregistrement[]> {
  let brut: unknown
  try {
    brut = JSON.parse(await readFile(path.join(dossier, 'metadata.json'), 'utf8'))
  } catch (erreur) {
    throw new Error(`Corpus illisible dans ${dossier} : ${(erreur as Error).message}`)
  }
  if (!Array.isArray(brut)) throw new Error('metadata.json doit contenir un tableau')
  const entrees = brut.filter(estEntree)
  const enregistrements: Enregistrement[] = []
  for (const entree of entrees) {
    const audio = new Uint8Array(await readFile(path.join(dossier, `${entree.id}.wav`)))
    const reference = (await readFile(path.join(dossier, `${entree.id}.txt`), 'utf8')).trim()
    enregistrements.push({
      ...entree,
      source: entree.source ?? 'inconnue',
      consentement: entree.consentement ?? 'inconnu',
      audio,
      reference,
    })
  }
  return enregistrements
}
