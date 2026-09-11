import { useLocalSearchParams, useRouter } from 'expo-router'

import { EcranChargement, EcranErreur } from '@/components/EcransEtat'
import { EcranPrise } from '@/components/EcranPrise'
import { t } from '@/i18n/fr'
import { useDuels } from '@/services/arene'

// The duel take: each speaks alone, within the cap of their formula. The invitee never hears
// the inviter before recording, so nothing is played on this screen.
export default function PriseDuel() {
  const params = useLocalSearchParams<{ id?: string }>()
  const id = typeof params.id === 'string' ? params.id : null
  const router = useRouter()
  const duels = useDuels()

  if (duels.isPending) return <EcranChargement />
  const duel = duels.data?.find((d) => d.id === id)
  if (!duel) {
    return <EcranErreur message={t('arene.refusInconnu')} reessayer={() => void duels.refetch()} />
  }
  return (
    <EcranPrise
      type="duel"
      duelId={duel.id}
      surtitre={t('arene.mesDuels')}
      titre={duel.sujet}
      consigne=""
      dureeMin={Math.min(20, duel.duree_max_s)}
      dureeMax={duel.duree_max_s}
      onTerminee={(tentativeId) => router.replace(`/analyse/${tentativeId}`)}
      onAnnuler={() => router.back()}
    />
  )
}
