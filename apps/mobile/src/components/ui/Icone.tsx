import type { ColorValue } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { SymbolView, type SymbolViewProps } from 'expo-symbols'
import { Platform } from 'react-native'

// SF Symbols on iOS, Material icons everywhere else. Each icon names both.

export type NomSF = Extract<SymbolViewProps['name'], string>
export type NomMaterial = keyof typeof MaterialIcons.glyphMap

type Props = {
  sf: NomSF
  material: NomMaterial
  taille?: number
  couleur: ColorValue
}

export function Icone({ sf, material, taille = 24, couleur }: Props) {
  const secours = <MaterialIcons name={material} size={taille} color={couleur} />
  if (Platform.OS !== 'ios') return secours
  return (
    <SymbolView
      name={sf}
      size={taille}
      tintColor={couleur}
      resizeMode="scaleAspectFit"
      fallback={secours}
    />
  )
}
