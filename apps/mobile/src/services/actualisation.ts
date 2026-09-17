import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'

// Pull to refresh. A screen's content changes behind the person (a passage published in the
// Arena, a duel answered, a workshop opened, an analysis landed), and the caches only refetch
// on their own schedule. Pulling down refetches every query mounted on that screen, no list
// to keep in step with the hooks the screen uses.

export function useActualisation(): { enCours: boolean; actualiser: () => Promise<void> } {
  const client = useQueryClient()
  const [enCours, setEnCours] = useState(false)
  const actualiser = useCallback(async () => {
    setEnCours(true)
    try {
      await client.refetchQueries({ type: 'active' })
    } finally {
      setEnCours(false)
    }
  }, [client])
  return { enCours, actualiser }
}
