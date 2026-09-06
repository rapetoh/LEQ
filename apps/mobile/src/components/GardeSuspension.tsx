import { usePathname, useRouter } from 'expo-router'
import { useEffect } from 'react'

import { useSuspension } from '@/services/rebecca'

// While the account is suspended, every screen but the suspension notice and the settings
// sends back to the notice. Mounted once in the root layout.
const OUVERTS = ['/suspendu', '/reglages']

export function GardeSuspension() {
  const suspension = useSuspension()
  const chemin = usePathname()
  const router = useRouter()
  useEffect(() => {
    if (suspension.data === true && !OUVERTS.some((prefixe) => chemin.startsWith(prefixe))) {
      router.replace('/suspendu')
    }
  }, [suspension.data, chemin, router])
  return null
}
