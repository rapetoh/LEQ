import { describe, expect, it } from 'vitest'
import { estModifie, texteDeValeur, validerSaisie } from './validation'

describe('validerSaisie', () => {
  it('parses numbers, accepting a French decimal comma', () => {
    expect(validerSaisie('points_par_defi', 'nombre', '30')).toEqual({ ok: true, valeur: 30 })
    expect(validerSaisie('x', 'nombre', '2,5')).toEqual({ ok: true, valeur: 2.5 })
  })

  it('refuses an empty or non-numeric number', () => {
    expect(validerSaisie('x', 'nombre', '')).toEqual({ ok: false, erreur: 'Saisis une valeur.' })
    expect(validerSaisie('x', 'nombre', 'abc')).toEqual({ ok: false, erreur: 'Saisis un nombre.' })
  })

  it('applies the contract rule of a known key', () => {
    const resultat = validerSaisie('points_par_defi', 'nombre', '-1')
    expect(resultat.ok).toBe(false)
  })

  it('parses JSON and reports a broken document', () => {
    expect(validerSaisie('x', 'json', '{"a": 1}')).toEqual({ ok: true, valeur: { a: 1 } })
    expect(validerSaisie('x', 'json', '{')).toEqual({ ok: false, erreur: 'JSON invalide.' })
  })

  it('keeps booleans and text', () => {
    expect(validerSaisie('x', 'booleen', true)).toEqual({ ok: true, valeur: true })
    expect(validerSaisie('x', 'texte', 'bonjour')).toEqual({ ok: true, valeur: 'bonjour' })
    expect(validerSaisie('x', 'texte', '   ').ok).toBe(false)
  })
})

describe('texteDeValeur and estModifie', () => {
  it('round-trips a stored value into the field and back', () => {
    expect(texteDeValeur('nombre', 25)).toBe('25')
    expect(texteDeValeur('json', { a: 1 })).toBe('{\n  "a": 1\n}')
    expect(estModifie('nombre', 25, '25')).toBe(false)
    expect(estModifie('nombre', 25, '26')).toBe(true)
    expect(estModifie('json', { a: 1 }, '{"a":1}')).toBe(false)
    expect(estModifie('booleen', false, true)).toBe(true)
  })
})
