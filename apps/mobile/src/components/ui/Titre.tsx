import { Text, type StyleProp, type TextStyle } from 'react-native'
import type { ReactNode } from 'react'

import { useTheme } from '@/theme/ThemeProvider'
import { typographie } from '@/theme/tokens'

type Props = {
  children: ReactNode
  niveau?: 'hero' | 'ecran' | 'section' | 'carte'
  /** On a hero screen the title is white. */
  surFondSombre?: boolean
  centre?: boolean
  style?: StyleProp<TextStyle>
}

const STYLES = {
  hero: typographie.titreHero,
  ecran: typographie.titreEcran,
  section: typographie.titreSection,
  carte: typographie.titreCarte,
} as const

const ROLES = { hero: 'header', ecran: 'header', section: 'header', carte: 'text' } as const

export function Titre({
  children,
  niveau = 'ecran',
  surFondSombre = false,
  centre = false,
  style,
}: Props) {
  const theme = useTheme()
  return (
    <Text
      accessibilityRole={ROLES[niveau]}
      style={[
        STYLES[niveau],
        { color: surFondSombre ? theme.heroTexte : theme.texte },
        centre && { textAlign: 'center' },
        style,
      ]}
    >
      {children}
    </Text>
  )
}
