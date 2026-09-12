import { urlMedia } from '@leq/domaine'
import { useState } from 'react'
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { rayons } from '@/theme/tokens'

// An image Rebecca published: a workshop, an announcement, a reward. It renders nothing at all
// when there is none, and nothing when the file fails to load, so a screen never shows an empty
// frame where a picture was meant to be.

const BASE = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''

type Props = {
  chemin: string | null | undefined
  /** Width over height. 16/9 for a card, 1 for a reward tile. */
  ratio?: number
  style?: StyleProp<ViewStyle>
}

export function ImageMedia({ chemin, ratio = 16 / 9, style }: Props) {
  const [echec, setEchec] = useState(false)
  const url = urlMedia(BASE, chemin ?? null)
  if (!url || echec) return null
  return (
    <View style={[styles.cadre, { aspectRatio: ratio }, style]}>
      <Image
        source={{ uri: url }}
        style={styles.image}
        resizeMode="cover"
        accessibilityRole="image"
        onError={() => setEchec(true)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  cadre: { width: '100%', borderRadius: rayons.m, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
})
