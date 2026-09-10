import { Redirect } from 'expo-router'

import { useDemarrage } from '@/services/configuration'

// First launch (no local flag "accueil_termine") goes to A1, everything else to Aujourd'hui.
// In development only, EXPO_PUBLIC_ECRAN_INITIAL opens a given route at launch, so a screen can
// be checked on the simulator without tapping through the onboarding (docs/RUNBOOK.md).
const ECRAN_INITIAL = __DEV__ ? (process.env.EXPO_PUBLIC_ECRAN_INITIAL ?? null) : null

export default function Index() {
  const { accueilTermine } = useDemarrage()
  if (ECRAN_INITIAL) return <Redirect href={ECRAN_INITIAL} />
  return <Redirect href={accueilTermine ? '/(onglets)/aujourdhui' : '/accueil/bienvenue'} />
}
