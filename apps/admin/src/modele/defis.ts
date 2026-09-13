// Pure model of the two banks Rebecca writes (docs/DATA-MODEL.md, `defis` and `exercices`),
// and of the forms that edit them: what the fields hold as text, how they validate, how the
// list is grouped and reordered. No I/O here.

import {
  DefiEditableSchema,
  ExerciceEditableSchema,
  FORMATS_DEFI,
  NOMS_FORMAT,
  type AppuiPlan,
  type Defi,
  type DefiEditable,
  type Exercice,
  type ExerciceEditable,
  type FormatDefi,
  type ModeleActe,
} from '@leq/domaine'

export { FORMATS_DEFI, NOMS_FORMAT }
export type { AppuiPlan, Defi, DefiEditable, Exercice, ExerciceEditable, FormatDefi, ModeleActe }

/** A field error, mapped to a sentence in fr.ts by the form. */
export type CodeErreur =
  | 'requis'
  | 'nombre'
  | 'entier'
  | 'positif'
  | 'cle'
  | 'texteRequis'
  | 'preparationRequise'
  | 'bande'
  | 'date'
  | 'contrat'

export type Erreurs = Partial<Record<string, CodeErreur>>

export type ResultatValidation<T> = { ok: true; valeur: T } | { ok: false; erreurs: Erreurs }

/** What the défi form holds: every number as text, so a half-typed value never crashes. */
export type SaisieDefi = {
  cle: string
  ordre_acte: string
  ordre: string
  format: FormatDefi
  titre: string
  consigne: string
  focus: string
  plan: AppuiPlan[]
  texte_a_lire: string
  duree_lecture_s: string
  duree_preparation_s: string
  duree_max_s: string
  points: string
  competence: string
  seuil_reussite: string
  provisoire: boolean
  actif: boolean
}

const DUREE_PAR_FORMAT: Record<FormatDefi, number> = { standard: 120, texte: 180, long: 300 }

/**
 * The technical key, derived from the title. It used to be typed by hand, which is asking someone
 * writing a challenge to also think like a database. It stays editable, because it names the row
 * for ever and the person writing may want to choose it.
 */
export function cleDepuisTitre(titre: string): string {
  return titre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
}

export function saisieVierge(ordreActe: number, ordre: number, points = 25): SaisieDefi {
  return {
    cle: '',
    ordre_acte: String(ordreActe),
    ordre: String(ordre),
    format: 'standard',
    titre: '',
    consigne: '',
    focus: '',
    plan: [],
    texte_a_lire: '',
    duree_lecture_s: '',
    duree_preparation_s: '',
    duree_max_s: String(DUREE_PAR_FORMAT.standard),
    points: String(points),
    competence: '',
    seuil_reussite: '',
    provisoire: true,
    actif: true,
  }
}

export function saisieDepuisDefi(defi: Defi): SaisieDefi {
  return {
    cle: defi.cle,
    ordre_acte: String(defi.ordre_acte),
    ordre: String(defi.ordre),
    format: defi.format,
    titre: defi.titre,
    consigne: defi.consigne,
    focus: defi.focus ?? '',
    plan: defi.plan.map((appui) => ({ titre: appui.titre, detail: appui.detail })),
    texte_a_lire: defi.texte_a_lire ?? '',
    duree_lecture_s: defi.duree_lecture_s === null ? '' : String(defi.duree_lecture_s),
    duree_preparation_s: defi.duree_preparation_s === null ? '' : String(defi.duree_preparation_s),
    duree_max_s: String(defi.duree_max_s),
    points: String(defi.points),
    competence: defi.competence,
    seuil_reussite: String(defi.seuil_reussite).replace('.', ','),
    provisoire: defi.provisoire,
    actif: defi.actif,
  }
}

/** The default maximum duration when the format changes and the field was untouched. */
export function dureeParDefaut(format: FormatDefi): number {
  return DUREE_PAR_FORMAT[format]
}

const CLE = /^[a-z0-9_]+$/

type Nombre = { ok: true; valeur: number | null } | { ok: false; code: CodeErreur }

function lireNombre(
  texte: string,
  options: { requis: boolean; entier: boolean; minimum: number },
): Nombre {
  const propre = texte.trim().replace(',', '.')
  if (propre === '')
    return options.requis ? { ok: false, code: 'requis' } : { ok: true, valeur: null }
  const n = Number(propre)
  if (!Number.isFinite(n)) return { ok: false, code: 'nombre' }
  if (options.entier && !Number.isInteger(n)) return { ok: false, code: 'entier' }
  if (n < options.minimum) return { ok: false, code: 'positif' }
  return { ok: true, valeur: n }
}

function texteOuNull(texte: string): string | null {
  const propre = texte.trim()
  return propre === '' ? null : propre
}

export function validerDefi(saisie: SaisieDefi): ResultatValidation<DefiEditable> {
  const erreurs: Erreurs = {}
  const nombres: Record<string, number | null> = {}

  const cle = saisie.cle.trim()
  if (cle === '') erreurs.cle = 'requis'
  else if (!CLE.test(cle)) erreurs.cle = 'cle'
  if (saisie.titre.trim() === '') erreurs.titre = 'requis'
  if (saisie.consigne.trim() === '') erreurs.consigne = 'requis'
  if (saisie.competence.trim() === '') erreurs.competence = 'requis'

  const regles: Record<string, { requis: boolean; entier: boolean; minimum: number }> = {
    ordre_acte: { requis: true, entier: true, minimum: 1 },
    ordre: { requis: true, entier: true, minimum: 1 },
    duree_max_s: { requis: true, entier: true, minimum: 1 },
    points: { requis: true, entier: true, minimum: 0 },
    seuil_reussite: { requis: true, entier: false, minimum: 0 },
  }
  // The fields of another format are dropped, never validated: a stale value left by a format
  // switch must not block the save with an error the form does not show.
  if (saisie.format === 'texte') regles.duree_lecture_s = { requis: true, entier: true, minimum: 1 }
  if (saisie.format === 'long')
    regles.duree_preparation_s = { requis: true, entier: true, minimum: 1 }
  for (const [champ, regle] of Object.entries(regles)) {
    const lu = lireNombre(saisie[champ as keyof SaisieDefi] as string, regle)
    if (lu.ok) nombres[champ] = lu.valeur
    else
      erreurs[champ] =
        champ === 'duree_preparation_s' && lu.code === 'requis' ? 'preparationRequise' : lu.code
  }

  const texte = texteOuNull(saisie.texte_a_lire)
  if (saisie.format === 'texte' && texte === null) erreurs.texte_a_lire = 'texteRequis'

  const plan = (saisie.format === 'long' ? saisie.plan : [])
    .map((appui) => ({ titre: appui.titre.trim(), detail: appui.detail.trim() }))
    .filter((appui) => appui.titre !== '' || appui.detail !== '')
  if (plan.some((appui) => appui.titre === '')) erreurs.plan = 'requis'

  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs }

  const candidat = {
    cle,
    ordre_acte: nombres.ordre_acte,
    ordre: nombres.ordre,
    format: saisie.format,
    titre: saisie.titre.trim(),
    consigne: saisie.consigne.trim(),
    focus: texteOuNull(saisie.focus),
    plan,
    texte_a_lire: saisie.format === 'texte' ? texte : null,
    duree_lecture_s: saisie.format === 'texte' ? (nombres.duree_lecture_s ?? null) : null,
    duree_preparation_s: saisie.format === 'long' ? (nombres.duree_preparation_s ?? null) : null,
    duree_max_s: nombres.duree_max_s,
    points: nombres.points,
    competence: saisie.competence.trim(),
    seuil_reussite: nombres.seuil_reussite,
    provisoire: saisie.provisoire,
    actif: saisie.actif,
  }
  const lu = DefiEditableSchema.safeParse(candidat)
  if (!lu.success) {
    for (const probleme of lu.error.issues) {
      const champ = String(probleme.path[0] ?? 'contrat')
      erreurs[champ] = 'contrat'
    }
    return { ok: false, erreurs }
  }
  return { ok: true, valeur: lu.data }
}

export type SaisieExercice = {
  cle: string
  titre: string
  consigne: string
  duree_s: string
  competence: string
  provisoire: boolean
  actif: boolean
}

export function saisieExerciceVierge(): SaisieExercice {
  return {
    cle: '',
    titre: '',
    consigne: '',
    duree_s: '30',
    competence: '',
    provisoire: true,
    actif: true,
  }
}

export function saisieDepuisExercice(exercice: Exercice): SaisieExercice {
  return {
    cle: exercice.cle,
    titre: exercice.titre,
    consigne: exercice.consigne,
    duree_s: String(exercice.duree_s),
    competence: exercice.competence,
    provisoire: exercice.provisoire,
    actif: exercice.actif,
  }
}

export function validerExercice(saisie: SaisieExercice): ResultatValidation<ExerciceEditable> {
  const erreurs: Erreurs = {}
  const cle = saisie.cle.trim()
  if (cle === '') erreurs.cle = 'requis'
  else if (!CLE.test(cle)) erreurs.cle = 'cle'
  if (saisie.titre.trim() === '') erreurs.titre = 'requis'
  if (saisie.consigne.trim() === '') erreurs.consigne = 'requis'
  if (saisie.competence.trim() === '') erreurs.competence = 'requis'
  const duree = lireNombre(saisie.duree_s, { requis: true, entier: true, minimum: 1 })
  if (!duree.ok) erreurs.duree_s = duree.code
  if (Object.keys(erreurs).length > 0 || !duree.ok) return { ok: false, erreurs }

  const lu = ExerciceEditableSchema.safeParse({
    cle,
    titre: saisie.titre.trim(),
    consigne: saisie.consigne.trim(),
    duree_s: duree.valeur,
    competence: saisie.competence.trim(),
    provisoire: saisie.provisoire,
    actif: saisie.actif,
  })
  if (!lu.success) {
    for (const probleme of lu.error.issues)
      erreurs[String(probleme.path[0] ?? 'contrat')] = 'contrat'
    return { ok: false, erreurs }
  }
  return { ok: true, valeur: lu.data }
}

export type GroupeActe = { acte: ModeleActe; defis: Defi[] }

/** Acts in order, each with its défis in order. Défis of an unknown act land in a virtual act. */
export function grouperParActe(actes: readonly ModeleActe[], defis: readonly Defi[]): GroupeActe[] {
  const groupes = [...actes]
    .sort((a, b) => a.ordre - b.ordre)
    .map((acte) => ({ acte, defis: [] as Defi[] }))
  for (const defi of [...defis].sort((a, b) => a.ordre - b.ordre)) {
    const groupe = groupes.find((g) => g.acte.ordre === defi.ordre_acte)
    if (groupe) groupe.defis.push(defi)
  }
  return groupes
}

/** The neighbour a défi swaps with when it moves up or down inside its act, or null at the edge. */
export function voisinPourEchange(
  defis: readonly Defi[],
  id: string,
  direction: 'haut' | 'bas',
): Defi | null {
  const courant = defis.find((d) => d.id === id)
  if (!courant) return null
  const memeActe = defis
    .filter((d) => d.ordre_acte === courant.ordre_acte)
    .sort((a, b) => a.ordre - b.ordre)
  const index = memeActe.findIndex((d) => d.id === id)
  const cible = direction === 'haut' ? index - 1 : index + 1
  return memeActe[cible] ?? null
}

/** The next free order inside an act. */
export function prochainOrdre(defis: readonly Defi[], ordreActe: number): number {
  return (
    defis.filter((d) => d.ordre_acte === ordreActe).reduce((max, d) => Math.max(max, d.ordre), 0) +
    1
  )
}

/** "2 min" for the list; the brief on the phone rounds the same way. */
export function minutesDe(secondes: number): number {
  return Math.max(1, Math.ceil(secondes / 60))
}
