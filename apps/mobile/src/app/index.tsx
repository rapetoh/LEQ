import { Redirect } from 'expo-router'

import { useDemarrage } from '@/services/configuration'

// First launch (no local flag "accueil_termine") goes to A1, everything else to Aujourd'hui.
export default function Index() {
  const { accueilTermine } = useDemarrage()
  return <Redirect href={accueilTermine ? '/(onglets)/aujourdhui' : '/accueil/bienvenue'} />
}
