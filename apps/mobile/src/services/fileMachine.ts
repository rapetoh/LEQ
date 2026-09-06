// The local queue of takes: pure state machine, no I/O, fully unit tested.
// Phone-only states of the cahier's diagram: enregistrement, en attente réseau,
// envoi, envoyée, annulée, expirée. The server never sees them (DATA-MODEL).
import type { TypeTentative } from '@leq/domaine'

export const ETATS_FILE = [
  'enregistrement',
  'en_attente_reseau',
  'envoi',
  'envoyee',
  'annulee',
  'expiree',
] as const
export type EtatFile = (typeof ETATS_FILE)[number]

export interface EntreeFile {
  /** The tentative id, generated on the phone before anything is uploaded. */
  id: string
  type: TypeTentative
  etape_id: string | null
  /** Absolute path of the audio file on the phone, null once deleted. */
  chemin: string | null
  /** When the person started speaking (ISO), the streak day comes from it. */
  enregistre_le: string
  fuseau_horaire: string
  decalage_minutes: number
  duree_s: number | null
  etat: EtatFile
  essais: number
  prochain_essai_a: string | null
  derniere_erreur: string | null
  /** When the entry reached a terminal state (ISO), for cleanup. */
  termine_le: string | null
}

export const ETATS_TERMINAUX: readonly EtatFile[] = ['envoyee', 'annulee', 'expiree']

/** 30 s, 60 s, 2 min, 4 min, 8 min, then 15 min forever. */
export const DELAI_BASE_S = 30
export const DELAI_MAX_S = 900
/** Sent entries stay one day in the index (for the screens), then leave. */
export const RETENTION_ENVOYEE_H = 24

export function delaiAvantEssaiS(essais: number): number {
  return Math.min(DELAI_BASE_S * 2 ** Math.max(0, essais), DELAI_MAX_S)
}

export interface DemarragePrise {
  id: string
  type: TypeTentative
  etape_id?: string | null
  enregistre_le: Date
  fuseau_horaire: string
  decalage_minutes: number
}

export function creerEntree(demarrage: DemarragePrise): EntreeFile {
  return {
    id: demarrage.id,
    type: demarrage.type,
    etape_id: demarrage.etape_id ?? null,
    chemin: null,
    enregistre_le: demarrage.enregistre_le.toISOString(),
    fuseau_horaire: demarrage.fuseau_horaire,
    decalage_minutes: demarrage.decalage_minutes,
    duree_s: null,
    etat: 'enregistrement',
    essais: 0,
    prochain_essai_a: null,
    derniere_erreur: null,
    termine_le: null,
  }
}

function exiger(entree: EntreeFile, attendus: readonly EtatFile[]): void {
  if (!attendus.includes(entree.etat)) {
    throw new Error(`Transition impossible depuis l'état ${entree.etat}`)
  }
}

/** The recorder returned a file: the take waits for the network. */
export function terminerEnregistrement(
  entree: EntreeFile,
  prise: { chemin: string; duree_s: number },
): EntreeFile {
  exiger(entree, ['enregistrement'])
  return {
    ...entree,
    chemin: prise.chemin,
    duree_s: prise.duree_s,
    etat: 'en_attente_reseau',
    prochain_essai_a: null,
  }
}

export function annuler(entree: EntreeFile, maintenant: Date): EntreeFile {
  exiger(entree, ['enregistrement', 'en_attente_reseau'])
  return { ...entree, etat: 'annulee', termine_le: maintenant.toISOString() }
}

export function marquerEnvoi(entree: EntreeFile): EntreeFile {
  exiger(entree, ['en_attente_reseau'])
  return { ...entree, etat: 'envoi' }
}

export function marquerEnvoyee(entree: EntreeFile, maintenant: Date): EntreeFile {
  exiger(entree, ['envoi'])
  return {
    ...entree,
    etat: 'envoyee',
    chemin: null,
    derniere_erreur: null,
    termine_le: maintenant.toISOString(),
  }
}

/** Back to waiting, with backoff. The file stays on the phone. */
export function marquerEchecEnvoi(
  entree: EntreeFile,
  erreur: string,
  maintenant: Date,
): EntreeFile {
  exiger(entree, ['envoi'])
  const essais = entree.essais + 1
  const prochain = new Date(maintenant.getTime() + delaiAvantEssaiS(entree.essais) * 1000)
  return {
    ...entree,
    etat: 'en_attente_reseau',
    essais,
    prochain_essai_a: prochain.toISOString(),
    derniere_erreur: erreur,
  }
}

/** An interrupted send (app killed) goes back to waiting without counting an attempt. */
export function reprendreEnvoiInterrompu(entree: EntreeFile): EntreeFile {
  if (entree.etat !== 'envoi') return entree
  return { ...entree, etat: 'en_attente_reseau', prochain_essai_a: null }
}

/**
 * A take still in `enregistrement` at startup means the app died mid-take: the file
 * may lack its moov atom, it is never uploaded (ADR-007).
 */
export function abandonnerEnregistrementInterrompu(
  entree: EntreeFile,
  maintenant: Date,
): EntreeFile {
  if (entree.etat !== 'enregistrement') return entree
  return {
    ...entree,
    etat: 'annulee',
    termine_le: maintenant.toISOString(),
    derniere_erreur: 'enregistrement interrompu',
  }
}

export function estExpiree(entree: EntreeFile, maintenant: Date, joursExpiration: number): boolean {
  if (entree.etat !== 'en_attente_reseau' && entree.etat !== 'enregistrement') return false
  const age = maintenant.getTime() - Date.parse(entree.enregistre_le)
  return age >= joursExpiration * 86_400_000
}

export function expirer(entree: EntreeFile, maintenant: Date): EntreeFile {
  return { ...entree, etat: 'expiree', termine_le: maintenant.toISOString() }
}

/** Entries ready to be sent now, oldest first. */
export function aEnvoyer(entrees: readonly EntreeFile[], maintenant: Date): EntreeFile[] {
  return entrees
    .filter((e) => e.etat === 'en_attente_reseau' && e.chemin !== null)
    .filter(
      (e) => e.prochain_essai_a === null || Date.parse(e.prochain_essai_a) <= maintenant.getTime(),
    )
    .sort((a, b) => Date.parse(a.enregistre_le) - Date.parse(b.enregistre_le))
}

/** Terminal entries old enough leave the index. Their files are already gone. */
export function nettoyer(entrees: readonly EntreeFile[], maintenant: Date): EntreeFile[] {
  return entrees.filter((e) => {
    if (!ETATS_TERMINAUX.includes(e.etat) || e.termine_le === null) return true
    return maintenant.getTime() - Date.parse(e.termine_le) < RETENTION_ENVOYEE_H * 3_600_000
  })
}

export function remplacer(entrees: readonly EntreeFile[], entree: EntreeFile): EntreeFile[] {
  const index = entrees.findIndex((e) => e.id === entree.id)
  if (index < 0) return [...entrees, entree]
  const copie = [...entrees]
  copie[index] = entree
  return copie
}
