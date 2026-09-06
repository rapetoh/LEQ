import { useLocalSearchParams, useRouter } from 'expo-router'

import { EcranChargement, EcranErreur } from '@/components/EcransEtat'
import { EcranPrise } from '@/components/EcranPrise'
import { t } from '@/i18n/fr'
import { useConfiguration } from '@/services/configuration'
import { useBrief } from '@/services/parcours'
import { surtitreFormat } from '@/services/rythme'

// B4 · L'enregistrement d'un défi: the diagnostic recorder, parameterised by the défi.
// The text format shows its text first, the long format runs its preparation.
export default function PriseDefi() {
  const params = useLocalSearchParams<{ etapeId?: string }>()
  const etapeId = typeof params.etapeId === 'string' ? params.etapeId : null
  const brief = useBrief(etapeId)
  const configuration = useConfiguration()
  const router = useRouter()

  if (brief.isPending) return <EcranChargement />
  if (brief.isError || !brief.data) {
    return (
      <EcranErreur
        message={brief.error?.message ?? t('defi.introuvable')}
        reessayer={() => void brief.refetch()}
      />
    )
  }
  const { defi, etape } = brief.data
  const dureeMin = Math.min(configuration.data?.duree_etape_min_s ?? 20, defi.duree_max_s)

  return (
    <EcranPrise
      type="etape"
      etapeId={etape.id}
      surtitre={surtitreFormat(defi.format, defi.duree_max_s)}
      titre={defi.titre}
      consigne={defi.consigne}
      encouragement={t('prise.ecouteCalme')}
      dureeMin={dureeMin}
      dureeMax={defi.duree_max_s}
      texteALire={defi.format === 'texte' ? defi.texte_a_lire : null}
      preparationS={defi.format === 'long' ? defi.duree_preparation_s : null}
      plan={defi.plan}
      onTerminee={(id) => router.replace(`/analyse/${id}`)}
      onAnnuler={() => router.back()}
    />
  )
}
