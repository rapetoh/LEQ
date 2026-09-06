import { useLocalSearchParams } from 'expo-router'

import { EcranAnalyse } from '@/components/EcranAnalyse'

// A5 for the diagnostic: a ready take opens the profile (A6).
export default function Analyse() {
  const params = useLocalSearchParams<{ id?: string }>()
  return <EcranAnalyse id={typeof params.id === 'string' ? params.id : null} suite="profil" />
}
