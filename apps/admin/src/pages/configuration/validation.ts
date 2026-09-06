// Turns what Rebecca typed into a value of the row's type, or a French error.
// Pure: no React, no Supabase, fully covered by validation.test.ts.

import { validerValeurContrat } from '../../domaine'
import { fr } from '../../fr'
import type { TypeConfiguration } from '../../modele/configuration'

export type Saisie = string | boolean

export type ResultatValidation = { ok: true; valeur: unknown } | { ok: false; erreur: string }

/** The text shown in the field for a stored value. */
export function texteDeValeur(type: TypeConfiguration, valeur: unknown): Saisie {
  switch (type) {
    case 'booleen':
      return valeur === true
    case 'nombre':
      return typeof valeur === 'number' ? String(valeur) : ''
    case 'texte':
      return typeof valeur === 'string' ? valeur : ''
    case 'json':
      return JSON.stringify(valeur, null, 2)
  }
}

export function validerSaisie(
  cle: string,
  type: TypeConfiguration,
  saisie: Saisie,
): ResultatValidation {
  let valeur: unknown
  switch (type) {
    case 'booleen':
      valeur = saisie === true
      break
    case 'nombre': {
      const texte = String(saisie).trim().replace(',', '.')
      if (texte === '') return { ok: false, erreur: fr.configuration.erreurs.vide }
      const nombre = Number(texte)
      if (!Number.isFinite(nombre)) return { ok: false, erreur: fr.configuration.erreurs.nombre }
      valeur = nombre
      break
    }
    case 'texte': {
      const texte = String(saisie)
      if (texte.trim() === '') return { ok: false, erreur: fr.configuration.erreurs.vide }
      valeur = texte
      break
    }
    case 'json': {
      const texte = String(saisie).trim()
      if (texte === '') return { ok: false, erreur: fr.configuration.erreurs.vide }
      try {
        valeur = JSON.parse(texte) as unknown
      } catch {
        return { ok: false, erreur: fr.configuration.erreurs.json }
      }
      break
    }
  }
  const erreurContrat = validerValeurContrat(cle, valeur)
  if (erreurContrat) return { ok: false, erreur: erreurContrat }
  return { ok: true, valeur }
}

/** True when the field differs from the stored value. */
export function estModifie(type: TypeConfiguration, valeur: unknown, saisie: Saisie): boolean {
  const resultat = validerSaisie('', type, saisie)
  if (!resultat.ok) return String(saisie) !== String(texteDeValeur(type, valeur))
  return JSON.stringify(resultat.valeur) !== JSON.stringify(valeur)
}
