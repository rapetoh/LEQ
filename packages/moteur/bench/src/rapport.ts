import { percentile } from '../../src/stats.js'
import type { FicheFournisseur } from './adaptateurs/commun.js'

export interface ResultatEnregistrement {
  id: string
  accent: string
  debit: string
  bruit: string
  duree_s: number
  wer: number
  latence_ms: number
}

export interface ResultatFournisseur {
  fiche: FicheFournisseur
  /** Null when the provider could not run (missing key, adapter not written). */
  indisponible: string | null
  resultats: ResultatEnregistrement[]
}

function moyenne(valeurs: number[]): number | null {
  if (valeurs.length === 0) return null
  return valeurs.reduce((a, b) => a + b, 0) / valeurs.length
}

function pct(v: number | null): string {
  return v === null ? 'n/a' : `${(v * 100).toFixed(1)} %`
}

function ms(v: number | null): string {
  return v === null ? 'n/a' : `${Math.round(v)} ms`
}

/** Groups by a metadata field and averages the WER inside each group. */
function parGroupe(
  resultats: ResultatEnregistrement[],
  champ: 'accent' | 'debit' | 'bruit',
): string {
  const groupes = new Map<string, number[]>()
  for (const r of resultats) {
    const liste = groupes.get(r[champ]) ?? []
    liste.push(r.wer)
    groupes.set(r[champ], liste)
  }
  return [...groupes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([nom, wers]) => `${nom} ${pct(moyenne(wers))} (${wers.length})`)
    .join(', ')
}

/** Markdown report of one bench run. */
export function rendreRapport(
  date: string,
  dossierCorpus: string,
  fournisseurs: ResultatFournisseur[],
): string {
  const lignes: string[] = []
  lignes.push(`# Bench STT du ${date}`, '', `Corpus : \`${dossierCorpus}\``, '')
  lignes.push(
    '| Fournisseur | Enregistrements | WER moyen | Latence p50 | Latence p95 | Coût / min | Traitement UE | Rétention |',
  )
  lignes.push('|---|---|---|---|---|---|---|---|')
  for (const f of fournisseurs) {
    if (f.indisponible !== null) {
      lignes.push(`| ${f.fiche.nom} | indisponible : ${f.indisponible} | | | | | | |`)
      continue
    }
    const wers = f.resultats.map((r) => r.wer)
    const latences = f.resultats.map((r) => r.latence_ms)
    const cout =
      f.fiche.cout_euros_par_minute === null
        ? 'n/a'
        : `${f.fiche.cout_euros_par_minute.toFixed(4)} €`
    lignes.push(
      `| ${f.fiche.nom} | ${f.resultats.length} | ${pct(moyenne(wers))} | ${ms(percentile(latences, 50))} | ${ms(percentile(latences, 95))} | ${cout} | ${f.fiche.traitement_ue} | ${f.fiche.retention} |`,
    )
  }
  lignes.push('')
  for (const f of fournisseurs) {
    if (f.indisponible !== null || f.resultats.length === 0) continue
    lignes.push(`## ${f.fiche.nom}`, '')
    lignes.push(`- Par accent : ${parGroupe(f.resultats, 'accent')}`)
    lignes.push(`- Par débit : ${parGroupe(f.resultats, 'debit')}`)
    lignes.push(`- Par bruit : ${parGroupe(f.resultats, 'bruit')}`)
    lignes.push('', '| Enregistrement | Accent | WER | Latence |', '|---|---|---|---|')
    for (const r of f.resultats)
      lignes.push(`| ${r.id} | ${r.accent} | ${pct(r.wer)} | ${ms(r.latence_ms)} |`)
    lignes.push('')
  }
  return lignes.join('\n')
}
