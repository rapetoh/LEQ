// Pure logic of the daily loop, shared by B1, B3 and H1 and covered by tests: what the
// step of the day means for the person, how a défi introduces itself, and where a node
// of the map leads. No React, no network.
import {
  NOMS_FORMAT,
  SousNotesSchema,
  type EtapeDuJour,
  type FormatDefi,
  type Formule,
  type ResultatTentative,
} from '@leq/domaine'

export type EtatAujourdhui =
  /** A step waits; `rattrapage` says the short exercise comes first (X5). */
  | { etat: 'defi'; rattrapage: boolean }
  /** The day's step is done on the free rhythm (H5, H5b). */
  | { etat: 'limite_jour' }
  /** The tries on the current step are spent for today. */
  | { etat: 'limite_essais' }
  /** The path has no step yet (empty bank, or acte III before Rebecca's content). */
  | { etat: 'aucune_etape' }
  /** Every step is validated. */
  | { etat: 'parcours_termine' }

export function etatAujourdhui(jour: EtapeDuJour): EtatAujourdhui {
  const { rythme, etape } = jour
  if (!rythme.peut_enregistrer) {
    switch (rythme.raison) {
      case 'limite_jour':
        return { etat: 'limite_jour' }
      case 'limite_essais':
        return { etat: 'limite_essais' }
      case 'parcours_termine':
        return { etat: 'parcours_termine' }
      case 'aucune_etape':
      case 'ok':
        return { etat: 'aucune_etape' }
    }
  }
  if (!etape || !jour.defi || !jour.acte) return { etat: 'aucune_etape' }
  return { etat: 'defi', rattrapage: etape.rattrapage_propose }
}

const ROMAINS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'] as const

/** Acts are numbered I, II, III as in the mockup. Beyond ten, the digit is kept. */
export function chiffreRomain(n: number): string {
  return ROMAINS[n - 1] ?? String(n)
}

/** "2 min" for 120 s, "3 min" for 170 s: the brief rounds up to whole minutes. */
export function minutesDe(secondes: number): number {
  return Math.max(1, Math.ceil(secondes / 60))
}

/** "Défi · 2 min", "Défi texte · 3 min", "Grand format · 5 min". */
export function surtitreFormat(format: FormatDefi, dureeMaxS: number): string {
  return `${NOMS_FORMAT[format]} · ${minutesDe(dureeMaxS)} min`
}

export type PositionDefi =
  | { genre: 'courante'; acte: string; titre: string; ordre: number; total: number }
  | { genre: 'derniere'; acte: string; titre: string }

/** The line under the title: "Acte II · Les crêtes du rythme · défi 3 sur 5", or the closing one. */
export function positionDefi(
  acte: { ordre: number; titre: string; sous_titre: string | null },
  ordre: number,
  total: number,
): PositionDefi {
  const base = { acte: chiffreRomain(acte.ordre), titre: acte.sous_titre ?? acte.titre }
  if (total > 1 && ordre === total) return { genre: 'derniere', ...base }
  return { genre: 'courante', ...base, ordre, total }
}

/**
 * The day's rhythm, read from the number alone. It used to ask the tier as well and answer
 * « sans limite » for Complet whatever its number said; the tiers are rows now and a third one
 * would have fallen through to « plusieurs par jour » whatever Rebecca had set.
 */
export function rythmeDeFormule(
  limiteEtapes: number,
): 'unParJour' | 'sansLimite' | 'plusieursParJour' {
  if (limiteEtapes === 0) return 'sansLimite'
  if (limiteEtapes === 1) return 'unParJour'
  return 'plusieursParJour'
}

export type NoeudCarte = {
  statut: 'verrouillee' | 'disponible' | 'validee'
  rattrapage_propose: boolean
}

/** Where a tap on a node of the map goes: the brief, the remediation first, or nowhere. */
export function destinationNoeud(noeud: NoeudCarte): 'brief' | 'rattrapage' | 'aucune' {
  if (noeud.statut !== 'disponible') return 'aucune'
  return noeud.rattrapage_propose ? 'rattrapage' : 'brief'
}

/** "il y a 3 semaines", "hier", "aujourd'hui": dates of past results, through Intl. */
export function ilYA(iso: string, maintenant: Date = new Date()): string {
  const instant = Date.parse(iso)
  if (!Number.isFinite(instant)) return ''
  const jours = Math.round((maintenant.getTime() - instant) / 86_400_000)
  const format = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
  const texte =
    Math.abs(jours) < 7
      ? format.format(-jours, 'day')
      : Math.abs(jours) < 30
        ? format.format(-Math.round(jours / 7), 'week')
        : Math.abs(jours) < 365
          ? format.format(-Math.round(jours / 30), 'month')
          : format.format(-Math.round(jours / 365), 'year')
  // The app writes the straight apostrophe everywhere (docs/STRINGS.md, rule 12).
  return texte.replace(/\u2019/g, "'")
}

/** Counts of the map header: validated steps over all steps of the visible acts. */
export function compterReleves(actes: readonly { etapes: readonly { statut: string }[] }[]): {
  faits: number
  total: number
} {
  let faits = 0
  let total = 0
  for (const acte of actes) {
    for (const etape of acte.etapes) {
      total += 1
      if (etape.statut === 'validee') faits += 1
    }
  }
  return { faits, total }
}

/** The maximum of a grid: the sum of the criteria maxima. Null when there is no grid. */
export function noteMax(sousNotes: unknown): number | null {
  const lues = SousNotesSchema.safeParse(sousNotes)
  if (!lues.success) return null
  const entrees = Object.values(lues.data)
  if (entrees.length === 0) return null
  return entrees.reduce((total, sousNote) => total + sousNote.max, 0)
}

export interface PriseDeResultat {
  id: string
  resultat: ResultatTentative | null
  etape: {
    ordre: number
    nb_etapes_acte: number
    tentative_validante_id: string | null
    acte: { statut: string }
  } | null
}

/** The act is closed by this take when it validated the act's last step (H3 instead of H2). */
export function fermeLActe(prise: PriseDeResultat): boolean {
  const etape = prise.etape
  if (!etape || prise.resultat !== 'etape_validee') return false
  return (
    etape.acte.statut === 'traverse' &&
    etape.tentative_validante_id === prise.id &&
    etape.ordre === etape.nb_etapes_acte
  )
}
