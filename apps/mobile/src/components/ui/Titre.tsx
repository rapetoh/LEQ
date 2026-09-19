import { Text, type StyleProp, type TextStyle } from 'react-native'
import type { ReactNode } from 'react'

import { useFondSombre } from '@/theme/FondSombre'
import { useTheme } from '@/theme/ThemeProvider'
import { typographie } from '@/theme/tokens'

type Props = {
  children: ReactNode
  niveau?: 'hero' | 'ecran' | 'section' | 'carte'
  /** On a bleu nuit ground the title is white. Read from the ground when omitted. */
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

export function Titre({ children, niveau = 'ecran', surFondSombre, centre = false, style }: Props) {
  const theme = useTheme()
  const fondSombre = useFondSombre()
  const sombre = surFondSombre ?? fondSombre
  return (
    <Text
      accessibilityRole={ROLES[niveau]}
      style={[
        STYLES[niveau],
        { color: sombre ? theme.heroTexte : theme.texte },
        centre && { textAlign: 'center' },
        style,
      ]}
    >
      {children}
    </Text>
  )
}
