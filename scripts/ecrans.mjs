#!/usr/bin/env node
/**
 * Prints every screen with the strings it renders, in the order it renders them.
 *
 * This is how a string is reviewed. Read alone in `fr.ts`, a sentence looks fine; the faults
 * are in what sits next to it. Every one Roch has caught was of that kind and every one was
 * readable here, with no simulator: a card whose footer repeated its own body, an account step
 * whose title was also its field label, one shared line that agreed with one title and not the
 * other. `npm run strings` refuses known bad shapes; this shows composition, which no regular
 * expression can judge.
 *
 *   npm run ecrans              every screen of the three applications
 *   npm run ecrans -- moi       only screens whose path matches "moi"
 *
 * What to look for, in order:
 *   1. the same fact twice on one screen, in any two of title, subtitle, status line, footnote;
 *   2. a line that explains a rule of the product instead of saying what happens to the person;
 *   3. a shared key sitting under two different titles, where number or gender stops agreeing.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, sep } from 'node:path'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')

const APPLICATIONS = [
  {
    nom: 'mobile',
    strings: 'apps/mobile/src/i18n/fr.ts',
    ecrans: ['apps/mobile/src/app', 'apps/mobile/src/components'],
    // Mobile reads through t('cle.pointee').
    motif: /\bt\(\s*['"`]([\w.]+)['"`]/g,
  },
  {
    nom: 'admin',
    strings: 'apps/admin/src/fr.ts',
    ecrans: ['apps/admin/src'],
    // Admin reads fr.cle.pointee directly.
    motif: /\bfr\.([\w.]+)/g,
  },
  { nom: 'web', strings: 'apps/web/src/fr.ts', ecrans: ['apps/web/src'], motif: /\bfr\.([\w.]+)/g },
]

/** Flattens a `fr.ts` object literal to "cle.pointee" -> the string a person reads. */
function lireStrings(chemin) {
  const source = readFileSync(join(RACINE, chemin), 'utf8').split('} as const')[0]
  const valeurs = new Map()
  const pile = []
  let attendu = null
  // A multi-line function body opens a brace that is not a group. Counting braces keeps the
  // path right: without this every key after the first such function resolved to the wrong
  // name, or to nothing, and the screen that used it looked empty.
  let opaque = 0
  const delta = (l) => (l.match(/\{/g) ?? []).length - (l.match(/\}/g) ?? []).length
  for (const ligne of source.split('\n')) {
    if (opaque > 0) {
      opaque += delta(ligne)
      attendu = null
      continue
    }
    // The object's own opening line ("export const fr = {") is neither a group nor a function.
    if (/=\s*\{\s*$/.test(ligne)) {
      attendu = null
      continue
    }
    let m = /^\s*(\w+):\s*\{\s*$/.exec(ligne)
    if (m) {
      pile.push(m[1])
      attendu = null
      continue
    }
    if (/^\s*\},?\s*$/.test(ligne)) {
      pile.pop()
      attendu = null
      continue
    }
    if (delta(ligne) > 0) {
      opaque += delta(ligne)
      attendu = null
      continue
    }
    m = /^\s*(\w+):\s*(['"])(.*)\2,?\s*$/.exec(ligne)
    if (m) {
      valeurs.set([...pile, m[1]].join('.'), m[3])
      attendu = null
      continue
    }
    // A string with values: `(n: number) => `${n} défis``
    m = /^\s*(\w+):\s*\(.*\)\s*=>\s*`(.*)`,?\s*$/.exec(ligne)
    if (m) {
      valeurs.set([...pile, m[1]].join('.'), m[2])
      attendu = null
      continue
    }
    // Prettier puts a long string on the line below its key.
    m = /^\s*(\w+):\s*$/.exec(ligne)
    if (m) {
      attendu = m[1]
      continue
    }
    m = /^\s*(['"])(.*)\1,?\s*$/.exec(ligne)
    if (m && attendu) {
      valeurs.set([...pile, attendu].join('.'), m[2])
      attendu = null
    }
  }
  return valeurs
}

function fichiers(dossier) {
  const complet = join(RACINE, dossier)
  let entrees
  try {
    entrees = readdirSync(complet)
  } catch {
    return []
  }
  const trouves = []
  for (const entree of entrees) {
    const chemin = join(complet, entree)
    if (statSync(chemin).isDirectory()) {
      trouves.push(...fichiers(join(dossier, entree)))
      continue
    }
    if (/\.tsx$/.test(entree) && !/\.test\./.test(entree)) trouves.push(chemin)
  }
  return trouves.sort()
}

const filtre = process.argv[2] ?? ''
let nbEcrans = 0

for (const app of APPLICATIONS) {
  const valeurs = lireStrings(app.strings)
  const sorties = []
  for (const dossier of app.ecrans) {
    for (const chemin of fichiers(dossier)) {
      const court = relative(join(RACINE, dossier), chemin).split(sep).join('/')
      if (filtre && !court.includes(filtre)) continue
      const source = readFileSync(chemin, 'utf8')
      // A screen often holds a group in a local ("const c = fr.banques.champs") and then reads
      // "c.cle". Without following the alias the form fields of ten admin screens were invisible,
      // and form fields are where a title and its own label repeat each other.
      const alias = new Map()
      for (const a of source.matchAll(/\bconst\s+(\w+)\s*=\s*fr\.([\w.]+)/g)) alias.set(a[1], a[2])
      const motifAlias =
        alias.size > 0
          ? new RegExp(`\\b(${[...alias.keys()].join('|')})\\.([\\w.]+)`, 'g')
          : null
      const vues = new Set()
      const lignes = []
      const trouvees = [...source.matchAll(app.motif)].map((m) => ({
        index: m.index,
        cle: m[1],
      }))
      if (motifAlias) {
        for (const a of source.matchAll(motifAlias)) {
          trouvees.push({ index: a.index, cle: `${alias.get(a[1])}.${a[2]}` })
        }
      }
      trouvees.sort((x, y) => x.index - y.index)
      for (const found of trouvees) {
        const cle = found.cle
        if (vues.has(cle)) continue
        vues.add(cle)
        const valeur = valeurs.get(cle)
        // A key that resolves to a group rather than a string renders nothing by itself.
        if (valeur !== undefined) lignes.push('   ' + valeur)
      }
      if (lignes.length === 0) continue
      nbEcrans += 1
      sorties.push(`\n### ${app.nom}/${court}`, ...lignes)
    }
  }
  if (sorties.length > 0) console.log(sorties.join('\n'))
}

console.error(
  `\n${nbEcrans} écran${nbEcrans > 1 ? 's' : ''}${filtre ? ` contenant « ${filtre} »` : ''}.`,
)
