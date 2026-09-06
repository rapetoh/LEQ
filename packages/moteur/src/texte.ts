/**
 * French text normalisation shared by the filler, repetition and WER modules.
 * Lowercase, NFC, typographic apostrophes unified, apostrophes and hyphens become
 * spaces ("l'homme" gives "l homme", "peut-être" gives "peut être"), every other
 * punctuation mark is dropped, whitespace collapsed. Accents are kept. Digits are
 * kept as digits (digits-to-words is out of scope).
 */

const PONCTUATION_FIN_DE_PHRASE = /[.!?…]+["»)]*$/u

/** Whether a raw transcript token closes a sentence (".", "!", "?", "…", "...", possibly followed by a closing quote). */
export function termineUnePhrase(mot: string): boolean {
  return PONCTUATION_FIN_DE_PHRASE.test(mot.trim())
}

/** Normalises free text into a list of comparable tokens. */
export function normaliserTexte(texte: string): string[] {
  return texte
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’‘ʼ`´]/gu, "'")
    .replace(/[‐-―-]/gu, ' ')
    .replace(/'/gu, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/u)
    .filter((t) => t.length > 0)
}

/**
 * Normalises one transcript word. Most words give one token; an elided form like
 * "l'idée" gives two ("l", "idée"), which are joined back with a space so the caller keeps
 * one entry per transcript word.
 */
export function normaliserMot(mot: string): string {
  return normaliserTexte(mot).join(' ')
}
