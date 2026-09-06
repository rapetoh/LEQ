// Pure model of a workshop form (docs/DATA-MODEL.md, `ateliers`). No I/O.
import {
  AtelierEditableSchema,
  type Atelier,
  type AtelierEditable,
  type CodeRegion,
} from '@leq/domaine'
import { fr } from '../fr'

export type SaisieAtelier = {
  titre: string
  sous_titre: string
  description: string
  lieu: string
  en_ligne: boolean
  region: CodeRegion | ''
  date_debut: string
  places: string
  lien: string
  recompense_id: string
  publie: boolean
}

export function vierge(): SaisieAtelier {
  return {
    titre: '',
    sous_titre: '',
    description: '',
    lieu: '',
    en_ligne: false,
    region: '',
    date_debut: '',
    places: '',
    lien: '',
    recompense_id: '',
    publie: false,
  }
}

/** Local `YYYY-MM-DDTHH:MM` for the datetime field, from an ISO instant. */
export function versChampDate(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function depuis(a: Atelier): SaisieAtelier {
  return {
    titre: a.titre,
    sous_titre: a.sous_titre ?? '',
    description: a.description ?? '',
    lieu: a.lieu,
    en_ligne: a.en_ligne,
    region: a.region ?? '',
    date_debut: versChampDate(a.date_debut),
    places: a.places === null ? '' : String(a.places),
    lien: a.lien ?? '',
    recompense_id: a.recompense_id ?? '',
    publie: a.publie,
  }
}

/** Text fields to the row the database expects; errors keyed by field. */
export function validerAtelier(
  s: SaisieAtelier,
): { ok: true; valeur: AtelierEditable } | { ok: false; erreurs: Record<string, string> } {
  const erreurs: Record<string, string> = {}
  if (s.titre.trim() === '') erreurs.titre = fr.banques.erreurs.requis
  if (s.lieu.trim() === '') erreurs.lieu = fr.banques.erreurs.requis
  const date = s.date_debut ? new Date(s.date_debut) : null
  if (!date || !Number.isFinite(date.getTime())) erreurs.date_debut = fr.banques.erreurs.requis
  const places = s.places.trim() === '' ? null : Number(s.places)
  if (places !== null && (!Number.isInteger(places) || places <= 0))
    erreurs.places = fr.banques.erreurs.positif
  if (Object.keys(erreurs).length > 0 || !date) return { ok: false, erreurs }
  const lu = AtelierEditableSchema.safeParse({
    titre: s.titre.trim(),
    sous_titre: s.sous_titre.trim() || null,
    description: s.description.trim() || null,
    lieu: s.lieu.trim(),
    en_ligne: s.en_ligne,
    region: s.en_ligne || s.region === '' ? null : s.region,
    date_debut: date.toISOString(),
    places,
    lien: s.lien.trim() || null,
    recompense_id: s.recompense_id || null,
    publie: s.publie,
  })
  if (!lu.success) {
    for (const probleme of lu.error.issues)
      erreurs[String(probleme.path[0])] = fr.banques.erreurs.contrat
    return { ok: false, erreurs }
  }
  return { ok: true, valeur: lu.data }
}
