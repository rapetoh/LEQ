import { describe, expect, it } from 'vitest'
import { contientContraste, contientFormuleInterdite, redresserApostrophes } from './client.js'

// docs/STRINGS.md, « How the text must not sound », applied to the only French the codebase does
// not write itself. The prompt bans these and the model produces them about one turn in three.
describe('ce que Rétor ne doit pas avoir écrit', () => {
  it('reconnaît la paire contrastive', () => {
    expect(
      contientContraste(
        "Dire la vérité n'est jamais pour se faire plaisir : c'est respecter l'autre.",
      ),
    ).toBe(true)
    expect(contientContraste("Ce n'est pas un argument, c'est une intuition.")).toBe(true)
    expect(contientContraste('Mentir n’est pas aider, mais tromper.')).toBe(true)
  })

  it('laisse passer une phrase plate', () => {
    expect(contientContraste('Dire la vérité respecte la personne en face.')).toBe(false)
    expect(contientContraste("Tu n'as pas répondu à la question sur le coût.")).toBe(false)
  })

  it('redresse les apostrophes', () => {
    expect(redresserApostrophes('C’est l’autre qui décide')).toBe("C'est l'autre qui décide")
  })
})

// The same rule on the judge's remarks and the debrief, which reach the feedback screen.
describe('ce que Bulle ne doit pas avoir écrit', () => {
  it('reconnaît les formes interdites', () => {
    expect(contientFormuleInterdite('Tu appuies ton idée, pas ta preuve.')).toBe(true)
    expect(contientFormuleInterdite("Voici ce que j'ai remarqué dans ta prise.")).toBe(true)
    expect(contientFormuleInterdite('Et toi, tu as cité un chiffre sans source.')).toBe(true)
    expect(contientFormuleInterdite('Tu as tenu ta ligne — jusqu’au bout.')).toBe(true)
    expect(contientFormuleInterdite('Bien joué !')).toBe(true)
    expect(contientFormuleInterdite("Ce n'est pas un argument, c'est une intuition.")).toBe(true)
  })

  it('laisse passer une remarque plate et précise', () => {
    expect(
      contientFormuleInterdite('Tu as donné deux exemples, tous les deux tirés de ton travail.'),
    ).toBe(false)
    expect(contientFormuleInterdite('Ta conclusion reprend mot pour mot ta première phrase.')).toBe(
      false,
    )
    expect(contientFormuleInterdite('Tu ne cites aucune source pour le chiffre de 40 %.')).toBe(
      false,
    )
  })
})
