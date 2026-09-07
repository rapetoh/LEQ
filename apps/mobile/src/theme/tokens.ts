// Design tokens of LEQ, taken from the validated mockup (Brainstorming/, 50 screens).
// Screens never use raw hex values: they read these tokens through useTheme().

export const couleurs = {
  bleuNuit: '#001636',
  bleu: '#114DA8',
  or: '#FFBD59',
  orange: '#FF5E01',
  encre: '#33415c',
  encre2: '#8fa3c4',
  encre3: '#c7d3e8',
  // oklch(0.965 0.006 80) converted to sRGB.
  fondChaud: '#F6F3EF',
  fondCarte: '#FFFFFF',
  orangeDoux: '#FFF3E2',
  bleuDoux: '#e8effc',
  vert: '#2c7a4b',
  rouge: '#c2410c',
  blanc: '#FFFFFF',
} as const

export const rayons = {
  s: 12,
  m: 14,
  l: 16,
  xl: 18,
  xxl: 20,
  xxxl: 22,
  pilule: 100,
} as const

export const espaces = {
  xxs: 4,
  xs: 8,
  s: 12,
  m: 16,
  l: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const

// Font family names as registered by @expo-google-fonts/manrope (loaded in app/_layout.tsx).
export const polices = {
  medium: 'Manrope_500Medium',
  semiBold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extraBold: 'Manrope_800ExtraBold',
} as const

export const typographie = {
  titreHero: { fontFamily: polices.extraBold, fontSize: 34, lineHeight: 40, letterSpacing: -0.6 },
  titreEcran: { fontFamily: polices.extraBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  titreSection: { fontFamily: polices.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  titreCarte: { fontFamily: polices.bold, fontSize: 17, lineHeight: 22 },
  corps: { fontFamily: polices.medium, fontSize: 16, lineHeight: 24 },
  corpsFort: { fontFamily: polices.semiBold, fontSize: 16, lineHeight: 24 },
  petit: { fontFamily: polices.medium, fontSize: 13, lineHeight: 18 },
  etiquette: { fontFamily: polices.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
  bouton: { fontFamily: polices.bold, fontSize: 16, lineHeight: 20 },
  chiffre: { fontFamily: polices.extraBold, fontSize: 32, lineHeight: 36, letterSpacing: -0.5 },
} as const

export type Theme = {
  nom: 'clair' | 'sombre'
  sombre: boolean
  // Content screens (warm white in the mockup, bleu nuit at night).
  fond: string
  carte: string
  carteDouce: string
  texte: string
  texteSecondaire: string
  texteTertiaire: string
  bordure: string
  // Action (orange) and voice (or).
  accent: string
  accentDoux: string
  accentTexte: string
  voix: string
  voixDoux: string
  lien: string
  // Hero screens are always bleu nuit, whatever the mode.
  hero: string
  heroTexte: string
  heroTexteSecondaire: string
  heroBordure: string
  /** Cards on a bleu nuit screen (the mockup's #0d2a4e). */
  heroCarte: string
  succes: string
  erreur: string
  barreOnglets: string
  barreOngletsBordure: string
  ongletActif: string
  ongletInactif: string
}

export const themeClair: Theme = {
  nom: 'clair',
  sombre: false,
  fond: couleurs.fondChaud,
  carte: couleurs.fondCarte,
  carteDouce: couleurs.bleuDoux,
  texte: couleurs.bleuNuit,
  texteSecondaire: couleurs.encre,
  texteTertiaire: couleurs.encre2,
  bordure: couleurs.encre3,
  accent: couleurs.orange,
  accentDoux: couleurs.orangeDoux,
  accentTexte: couleurs.blanc,
  voix: couleurs.or,
  voixDoux: '#FFF1D6',
  lien: couleurs.bleu,
  hero: couleurs.bleuNuit,
  heroTexte: couleurs.blanc,
  heroTexteSecondaire: couleurs.encre3,
  heroBordure: 'rgba(255, 255, 255, 0.28)',
  heroCarte: '#0D2A4E',
  succes: couleurs.vert,
  erreur: couleurs.rouge,
  barreOnglets: couleurs.fondCarte,
  barreOngletsBordure: '#E6E1DA',
  ongletActif: couleurs.orange,
  ongletInactif: couleurs.encre2,
}

export const themeSombre: Theme = {
  nom: 'sombre',
  sombre: true,
  fond: couleurs.bleuNuit,
  carte: '#0B2450',
  carteDouce: '#12305F',
  texte: couleurs.blanc,
  texteSecondaire: couleurs.encre3,
  texteTertiaire: couleurs.encre2,
  bordure: 'rgba(199, 211, 232, 0.25)',
  accent: couleurs.orange,
  accentDoux: '#3A2410',
  accentTexte: couleurs.blanc,
  voix: couleurs.or,
  voixDoux: '#3D2F14',
  lien: couleurs.or,
  hero: couleurs.bleuNuit,
  heroTexte: couleurs.blanc,
  heroTexteSecondaire: couleurs.encre3,
  heroBordure: 'rgba(255, 255, 255, 0.28)',
  heroCarte: '#0D2A4E',
  succes: '#5FB884',
  erreur: '#F0844F',
  barreOnglets: '#061C42',
  barreOngletsBordure: 'rgba(199, 211, 232, 0.15)',
  ongletActif: couleurs.or,
  ongletInactif: couleurs.encre2,
}
