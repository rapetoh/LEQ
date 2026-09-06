// Follows one take from the phone's queue to the server's statuses, so the waiting
// screen can say what is really happening (X2, A5, X3) and open the feedback when it
// is ready. Realtime first, polling every 15 s as the fallback.
import type { StatutTentative } from '@leq/domaine'
import { useNetworkState } from 'expo-network'
import { useEffect, useRef, useState } from 'react'

import { file } from '@/services/prises'
import type { EntreeFile } from '@/services/fileMachine'
import { supabase } from '@/services/supabase'

export type EtapeSuivi =
  /** Still on the phone: waiting for the network, or sending. */
  | { phase: 'telephone'; entree: EntreeFile; horsLigne: boolean; aEchoue: boolean }
  /** Uploaded; the worker is at the given status. */
  | { phase: 'serveur'; statut: StatutTentative }
  /** The feedback exists. */
  | { phase: 'pret' }
  /** The server gave up (abandon_technique): the audio is gone, the take must be redone. */
  | { phase: 'echec_serveur' }
  /** Nothing known about this id (cleaned up or never existed). */
  | { phase: 'inconnu' }

const INTERVALLE_SONDAGE_MS = 15_000

export function useSuiviPrise(id: string | null): EtapeSuivi {
  const reseau = useNetworkState()
  const horsLigne = reseau.isConnected === false
  const [entree, setEntree] = useState<EntreeFile | null>(null)
  const [statut, setStatut] = useState<StatutTentative | null>(null)
  const [fileChargee, setFileChargee] = useState(false)
  const statutRef = useRef<StatutTentative | null>(null)

  useEffect(() => {
    if (!id) return
    return file.abonner((entrees) => {
      setEntree(entrees.find((e) => e.id === id) ?? null)
      setFileChargee(true)
    })
  }, [id])

  const surTelephone = entree !== null && entree.etat !== 'envoyee'

  useEffect(() => {
    if (!id || surTelephone || !fileChargee) return
    let actif = true

    const lire = async () => {
      const { data } = await supabase.from('tentatives').select('statut').eq('id', id).maybeSingle()
      if (!actif) return
      const valeur = (data?.statut as StatutTentative | undefined) ?? null
      if (valeur && valeur !== statutRef.current) {
        statutRef.current = valeur
        setStatut(valeur)
      }
    }

    void lire()
    const minuteur = setInterval(() => void lire(), INTERVALLE_SONDAGE_MS)
    const canal = supabase
      .channel(`tentative:${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tentatives', filter: `id=eq.${id}` },
        (evenement) => {
          const nouveau = (evenement.new as { statut?: StatutTentative }).statut
          if (nouveau && actif) {
            statutRef.current = nouveau
            setStatut(nouveau)
          }
        },
      )
      .subscribe()

    return () => {
      actif = false
      clearInterval(minuteur)
      void supabase.removeChannel(canal)
    }
  }, [id, surTelephone, fileChargee])

  if (!id) return { phase: 'inconnu' }
  if (entree && entree.etat !== 'envoyee') {
    if (entree.etat === 'annulee' || entree.etat === 'expiree') return { phase: 'inconnu' }
    return { phase: 'telephone', entree, horsLigne, aEchoue: entree.essais > 0 }
  }
  if (statut === 'retour_disponible') return { phase: 'pret' }
  if (statut === 'abandon_technique') return { phase: 'echec_serveur' }
  if (statut) return { phase: 'serveur', statut }
  if (entree?.etat === 'envoyee') return { phase: 'serveur', statut: 'envoyee' }
  return fileChargee ? { phase: 'inconnu' } : { phase: 'serveur', statut: 'envoyee' }
}
