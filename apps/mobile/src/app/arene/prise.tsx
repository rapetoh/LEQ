import { useRouter } from 'expo-router'

import { EcranChargement, EcranErreur } from '@/components/EcransEtat'
import { EcranPrise } from '@/components/EcranPrise'
import { t } from '@/i18n/fr'
import { useSujet } from '@/services/arene'

// The Arena take: the same recorder as everywhere, on the subject of the week. Publishing it
// is a second, deliberate gesture, offered on the feedback screen once the analysis is done.
export default function PriseArene() {
  const router = useRouter()
  const sujet = useSujet()

  if (sujet.isPending) return <EcranChargement />
  if (sujet.isError || !sujet.data) {
    return (
      <EcranErreur message={t('arene.refusAucunSujet')} reessayer={() => void sujet.refetch()} />
    )
  }
  return (
    <EcranPrise
      type="arene"
      surtitre={t('arene.sujetSemaine')}
      titre={sujet.data.texte}
      consigne={sujet.data.consigne ?? ''}
      dureeMin={Math.min(20, sujet.data.duree_max_s)}
      dureeMax={sujet.data.duree_max_s}
      onTerminee={(id) => router.replace(`/analyse/${id}`)}
      onAnnuler={() => router.back()}
    />
  )
}
