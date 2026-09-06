// Groups configuration keys into the sections of the page. Labels live in fr.ts.
// A key that belongs to no section lands in "autres", so a new key is never hidden.

export const SECTIONS = [
  'points',
  'diagnostic',
  'parcours',
  'arene',
  'faceAFace',
  'annonces',
  'nettoyage',
  'autres',
] as const
export type Section = (typeof SECTIONS)[number]

const CLES_PAR_SECTION: Record<Exclude<Section, 'autres'>, readonly string[]> = {
  points: ['points_par_defi', 'points_par_vote'],
  diagnostic: ['duree_diagnostic_min_s', 'duree_diagnostic_max_s'],
  parcours: [
    'etapes_par_jour_gratuit',
    'etapes_par_jour_complet',
    'essais_max_etape_par_jour',
    'duree_etape_min_s',
    'recuperations_serie_par_mois',
  ],
  arene: [
    'duree_sujet_arene_jours',
    'duree_duel_heures',
    'plafond_duree_duel_gratuit_s',
    'plafond_duree_duel_complet_s',
  ],
  faceAFace: [
    'quota_face_a_face_complet',
    'duree_face_a_face_gratuit_s',
    'duree_face_a_face_complet_s',
    'reprise_debat_minutes',
  ],
  annonces: ['plafond_annonces_par_mois'],
  nettoyage: ['purge_anonymes_heures', 'expiration_file_locale_jours', 'balayage_audio_heures'],
}

export function sectionDeCle(cle: string): Section {
  for (const section of SECTIONS) {
    if (section === 'autres') continue
    if (CLES_PAR_SECTION[section].includes(cle)) return section
  }
  return 'autres'
}

/** Sorts keys by the contract order, unknown keys last in alphabetical order. */
export function trierCles(cles: readonly string[], ordre: readonly string[]): string[] {
  const rang = new Map(ordre.map((cle, index) => [cle, index]))
  return [...cles].sort((a, b) => {
    const ra = rang.get(a)
    const rb = rang.get(b)
    if (ra !== undefined && rb !== undefined) return ra - rb
    if (ra !== undefined) return -1
    if (rb !== undefined) return 1
    return a.localeCompare(b, 'fr')
  })
}
