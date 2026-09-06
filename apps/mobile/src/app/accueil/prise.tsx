import { useRouter } from 'expo-router'

import { EcranPrise } from '@/components/EcranPrise'
import { t } from '@/i18n/fr'
import { enregistrerReponsesAccueil, type ReponsesLocales } from '@/services/accueil'
import { useConfiguration } from '@/services/configuration'
import { ecrireJson, lireJson, CLES } from '@/services/stockage'
import { supabase } from '@/services/supabase'

// A4 · La prise de diagnostic. One take of 60 to 90 seconds, then the analysis screen.
export default function Prise() {
  const router = useRouter()
  const configuration = useConfiguration()
  return (
    <EcranPrise
      type="diagnostic"
      surtitre={t('prise.surtitre')}
      titre={t('prise.unePrise')}
      consigne={t('prise.consigne')}
      dureeMin={configuration.data?.duree_diagnostic_min_s ?? 60}
      dureeMax={configuration.data?.duree_diagnostic_max_s ?? 90}
      onTerminee={(id) => {
        void ecrireJson(CLES.priseDiagnostic, id)
        void envoyerReponses()
        router.replace({ pathname: '/accueil/analyse', params: { id } })
      }}
      onAnnuler={() => router.back()}
    />
  )
}

async function envoyerReponses(): Promise<void> {
  try {
    const reponses = await lireJson<ReponsesLocales>(CLES.reponsesAccueil)
    const { data } = await supabase.auth.getSession()
    const id = data.session?.user.id
    if (reponses && id) await enregistrerReponsesAccueil(id, reponses)
  } catch (erreur) {
    console.warn('accueil: réponses non envoyées, nouvel essai plus tard', erreur)
  }
}
