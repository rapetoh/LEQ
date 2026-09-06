import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { AppState } from 'react-native'

import { useConfiguration } from '@/services/configuration'
import { useSerie } from '@/services/progres'
import { appliquerRappels } from '@/services/rappels'
import { supabase, useSession } from '@/services/supabase'

// Keeps the two local notifications in step with the person's switches, the configured hour
// and today's streak. Mounted once in the root layout.

type ReglagesProfil = { notif_rappel: boolean; notif_serie: boolean; heure_rappel: string }

export const CLE_REGLAGES_RAPPELS = ['profil_rappels'] as const

export function Rappels() {
  const { session } = useSession()
  const configuration = useConfiguration()
  const serie = useSerie()
  const reglages = useQuery({
    queryKey: CLE_REGLAGES_RAPPELS,
    enabled: session !== null,
    queryFn: async (): Promise<ReglagesProfil> => {
      const { data, error } = await supabase
        .from('profils')
        .select('notif_rappel, notif_serie, heure_rappel')
        .eq('id', session?.user.id)
        .single()
      if (error) throw new Error(error.message)
      return data as ReglagesProfil
    },
  })

  const profil = reglages.data
  const heureAlerte = configuration.data?.heure_alerte_serie
  const valideeAujourdhui = serie.data?.validee_aujourdhui

  useEffect(() => {
    if (!profil || heureAlerte === undefined || valideeAujourdhui === undefined) return
    const appliquer = () =>
      void appliquerRappels({
        notif_rappel: profil.notif_rappel,
        heure_rappel: profil.heure_rappel,
        notif_serie: profil.notif_serie,
        heure_alerte_serie: heureAlerte,
        validee_aujourdhui: valideeAujourdhui,
      })
    appliquer()
    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') {
        void serie.refetch()
        appliquer()
      }
    })
    return () => abonnement.remove()
    // serie.refetch is stable enough for this purpose; the deps that matter are the values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profil, heureAlerte, valideeAujourdhui])

  return null
}
