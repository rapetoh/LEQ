#!/usr/bin/env node
/**
 * Guards the writing rules of docs/STRINGS.md that a machine can actually check.
 *
 * The rules it enforces are the ones a reviewer keeps missing, because they are
 * rhythmic rather than semantic: a sentence that states a fact and then negates its
 * opposite ("X, pas Y"), a slogan, an exclamation mark used to sound warm. Those
 * constructions are what makes a French interface read as machine-written, and they
 * are the reason for the pass recorded in docs/STRINGS.md.
 *
 * Run by `npm run check`. A justified exception goes in EXCEPTIONS below, with its
 * reason, so the list itself stays reviewable in a diff.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Where user-facing French lives. `jusqua` stops the scan before the helper code at
 * the bottom of a module, so a ternary or a regex is never read as prose.
 */
const SOURCES = [
  { fichier: 'apps/mobile/src/i18n/fr.ts', jusqua: '} as const' },
  { fichier: 'apps/admin/src/fr.ts', jusqua: '} as const' },
  { fichier: 'apps/web/src/fr.ts', jusqua: '} as const' },
  { fichier: 'packages/domaine/src/debatProtocole.ts', depuis: 'MESSAGES_ERREUR_DEBAT' },
  { fichier: 'packages/domaine/src/notifications.ts', depuis: 'MESSAGE_RETOUR_PRET' },
]

/** Verbatim strings allowed to break a rule, each with the reason it is allowed. */
const EXCEPTIONS = new Map([
  [
    'Modifié, pas encore enregistré.',
    'a state label, not a rhetorical pair: the field is modified and not yet saved',
  ],
])

const REGLES = [
  {
    nom: 'the application describing itself instead of speaking',
    motif: /\b(?:Voici ce que|Chaque ligne est|Ce que l'application montre|Ici, tu)\b/u,
    aide: 'LEQ never captions its own screens. Say the thing, do not announce it. "Contacte la personne, puis marque l\'échange honoré", not "Chaque ligne est une personne qui a dépensé ses points".',
  },
  {
    nom: 'internal vocabulary leaking into the interface',
    motif: /\b(?:le seed|la migration|dans la base|le serveur|chapitre \d|docs\/|DATA-MODEL)\b/iu,
    aide: 'Nobody reading this screen knows what a seed, a server or a chapter of the cahier is. Say what the person sees or does.',
  },
  {
    nom: 'contrastive pair ("X, pas Y" / "X, jamais Y")',
    motif: /,\s(?:pas|jamais|non pas)\s/u,
    aide: 'State the fact and stop. "Seuls tes résultats sont conservés", not "on garde tes résultats, jamais l\'audio".',
  },
  {
    nom: 'negated opposite after a colon (": pas ..." / ": jamais ...")',
    motif: /:\s(?:pas|jamais)\s/u,
    aide: 'Same tell with a colon. Say what is true, drop the negated half.',
  },
  {
    nom: 'slogan or filler phrase',
    motif:
      /\b(?:juste ça|rien d'autre|pour de vrai|pas de problème|personne d'autre|et c'est tout)\b/iu,
    aide: 'These are rhythm, not information. Cut the phrase.',
  },
  {
    nom: 'exclamation mark',
    motif: /!/u,
    aide: 'STRINGS.md rule 5: warmth comes from saying true things simply, never from punctuation.',
  },
  {
    nom: 'em dash or en dash',
    motif: /[–—]/u,
    aide: 'Use a comma, a period or a colon. Hyphens stay in compound words.',
  },
  {
    nom: 'curly apostrophe',
    motif: /’/u,
    aide: 'The straight apostrophe is used throughout, consistently.',
  },
  {
    nom: 'plain space before ":" (French typography)',
    motif: / :/u,
    aide: 'Use a no-break space (U+00A0) before ":".',
  },
  {
    nom: 'plain space before "?", "!" or ";" (French typography)',
    motif: / [?;]/u,
    aide: 'Use a narrow no-break space (U+202F) before "?", "!" and ";".',
  },
  {
    nom: 'plain space inside guillemets',
    motif: /« | »/u,
    aide: 'Use a narrow no-break space (U+202F) inside « ».',
  },
]

/**
 * Every quoted literal in a slice of TypeScript, comments excluded. It walks the source
 * rather than matching a regex over it, so a "//" inside a string stays a string and the
 * rule prose written in a comment is never checked against the rules.
 */
function litteraux(source) {
  const trouves = []
  let i = 0
  while (i < source.length) {
    const c = source[i]
    if (c === '/' && source[i + 1] === '/') {
      const fin = source.indexOf('\n', i)
      i = fin === -1 ? source.length : fin
      continue
    }
    if (c === '/' && source[i + 1] === '*') {
      const fin = source.indexOf('*/', i + 2)
      i = fin === -1 ? source.length : fin + 2
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      const debut = i
      let valeur = ''
      i += 1
      while (i < source.length && source[i] !== c) {
        if (source[i] === '\\') {
          valeur += source[i + 1] ?? ''
          i += 2
          continue
        }
        valeur += source[i]
        i += 1
      }
      i += 1
      if (valeur) trouves.push({ valeur, index: debut })
      continue
    }
    i += 1
  }
  return trouves
}

function ligneDe(source, index) {
  return source.slice(0, index).split('\n').length
}

let echecs = 0

for (const { fichier, jusqua, depuis } of SOURCES) {
  const chemin = join(RACINE, fichier)
  let source
  try {
    source = readFileSync(chemin, 'utf8')
  } catch {
    console.error(`strings: ${fichier} est introuvable`)
    echecs += 1
    continue
  }

  // Only the region that holds prose, so helper code below it is never scanned.
  let decalage = 0
  if (depuis) {
    const debut = source.indexOf(depuis)
    if (debut !== -1) {
      decalage = debut
      source = source.slice(debut)
    }
  }
  if (jusqua) {
    const fin = source.indexOf(jusqua)
    if (fin !== -1) source = source.slice(0, fin)
  }

  for (const { valeur, index } of litteraux(source)) {
    if (EXCEPTIONS.has(valeur)) continue
    for (const regle of REGLES) {
      if (!regle.motif.test(valeur)) continue
      const ligne =
        ligneDe(source, index) + (depuis ? ligneDe(readFileSync(chemin, 'utf8'), decalage) - 1 : 0)
      console.error(`\n${relative(RACINE, chemin)}:${ligne}  ${regle.nom}`)
      console.error(`  « ${valeur} »`)
      console.error(`  ${regle.aide}`)
      echecs += 1
    }
  }
}

if (echecs > 0) {
  console.error(
    `\n${echecs} string${echecs > 1 ? 's' : ''} ne respecte${echecs > 1 ? 'nt' : ''} pas docs/STRINGS.md.`,
  )
  console.error(
    'Corrige le texte, ou ajoute une exception motivée dans scripts/verifier-strings.mjs.',
  )
  process.exit(1)
}

console.log(`strings: ${SOURCES.length} modules vérifiés, aucune formulation interdite.`)
