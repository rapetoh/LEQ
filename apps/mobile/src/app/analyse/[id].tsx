import { useLocalSearchParams } from 'expo-router'

import { EcranAnalyse } from '@/components/EcranAnalyse'

// X2 for a step: a ready take opens the feedback (B5).
export default function AnalyseEtape() {
  const params = useLocalSearchParams<{ id?: string }>()
  return <EcranAnalyse id={typeof params.id === 'string' ? params.id : null} suite="retour" />
}
