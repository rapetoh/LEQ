import { describe, expect, it } from 'vitest'
import { contientContraste, redresserApostrophes } from './client.js'

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
