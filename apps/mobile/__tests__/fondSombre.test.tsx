import { render } from '@testing-library/react-native'

import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Titre } from '@/components/ui/Titre'
import { FondSombre } from '@/theme/FondSombre'
import { FournisseurTheme } from '@/theme/ThemeProvider'
import { themeClair } from '@/theme/tokens'

// Bleu nuit on bleu nuit, three times in two days: a secondary button or a title on a dark card
// that nobody told it was dark. The ground answers for them now, and this is what says so.

/** The colour a text actually renders with, whatever depth its style array has. */
function couleurDe(element: { props: Record<string, unknown> }): string | undefined {
  const styles = [element.props['style']].flat(3) as Array<{ color?: string } | undefined>
  return styles.reduce<string | undefined>((trouvee, s) => s?.color ?? trouvee, undefined)
}

describe('le fond sombre se lit tout seul', () => {
  it('draws a button and a title light on a dark card, without being told', async () => {
    const ecran = await render(
      <FournisseurTheme>
        <Carte teinte="sombre">
          <Titre niveau="section">Le podium</Titre>
          <Bouton libelle="Voir" variante="secondaire" onPress={() => undefined} />
        </Carte>
      </FournisseurTheme>,
    )
    expect(couleurDe(ecran.getByText('Le podium'))).toBe(themeClair.heroTexte)
    expect(couleurDe(ecran.getByText('Voir'))).toBe(themeClair.heroTexte)
  })

  it('keeps them dark on a light card', async () => {
    const ecran = await render(
      <FournisseurTheme>
        <Carte>
          <Titre niveau="section">Le classement</Titre>
          <Bouton libelle="Voter" variante="secondaire" onPress={() => undefined} />
        </Carte>
      </FournisseurTheme>,
    )
    expect(couleurDe(ecran.getByText('Le classement'))).toBe(themeClair.texte)
    expect(couleurDe(ecran.getByText('Voter'))).toBe(themeClair.texte)
  })

  it('lets a light card inside a dark screen go back to dark ink', async () => {
    const ecran = await render(
      <FournisseurTheme>
        <FondSombre>
          <Carte teinte="douce">
            <Titre niveau="section">Sur fond clair</Titre>
          </Carte>
          <Titre niveau="section">Sur fond sombre</Titre>
        </FondSombre>
      </FournisseurTheme>,
    )
    expect(couleurDe(ecran.getByText('Sur fond clair'))).toBe(themeClair.texte)
    expect(couleurDe(ecran.getByText('Sur fond sombre'))).toBe(themeClair.heroTexte)
  })

  it('still obeys a caller that says it explicitly', async () => {
    const ecran = await render(
      <FournisseurTheme>
        <Carte teinte="sombre">
          <Titre niveau="section" surFondSombre={false}>
            Forcé clair
          </Titre>
        </Carte>
      </FournisseurTheme>,
    )
    expect(couleurDe(ecran.getByText('Forcé clair'))).toBe(themeClair.texte)
  })
})
