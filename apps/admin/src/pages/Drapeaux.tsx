import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useSession } from '../auth/sessionContext'
import { DialogueConfirmation } from '../composants/Dialogue'
import { Interrupteur } from '../composants/Interrupteur'
import { useNotifier } from '../composants/toastContext'
import { ordreClesDrapeaux } from '../domaine'
import { fr } from '../fr'
import { estCleDrapeau, type CleDrapeau, type EntreeDrapeau } from '../modele/drapeaux'
import {
  chargerDrapeaux,
  cleRequeteDrapeaux,
  enregistrerDrapeau,
  type ModificationDrapeau,
} from '../services/drapeaux'
import styles from './Drapeaux.module.css'

/** Three switches. Turning one on asks for confirmation: it becomes visible to everyone. */
export function Drapeaux() {
  const { session } = useSession()
  const notifier = useNotifier()
  const clientRequetes = useQueryClient()
  const [aConfirmer, setAConfirmer] = useState<CleDrapeau | null>(null)

  const requete = useQuery({ queryKey: cleRequeteDrapeaux, queryFn: chargerDrapeaux })

  const mutation = useMutation({
    mutationFn: enregistrerDrapeau,
    onMutate: async (modification: ModificationDrapeau) => {
      await clientRequetes.cancelQueries({ queryKey: cleRequeteDrapeaux })
      const precedent = clientRequetes.getQueryData<EntreeDrapeau[]>(cleRequeteDrapeaux)
      clientRequetes.setQueryData<EntreeDrapeau[]>(cleRequeteDrapeaux, (lignes) =>
        lignes?.map((ligne) =>
          ligne.cle === modification.cle ? { ...ligne, actif: modification.actif } : ligne,
        ),
      )
      return { precedent }
    },
    onError: (erreur: Error, _modification, contexte) => {
      if (contexte?.precedent) clientRequetes.setQueryData(cleRequeteDrapeaux, contexte.precedent)
      notifier({ type: 'erreur', message: fr.drapeaux.toasts.erreur, details: erreur.message })
    },
    onSuccess: () => notifier({ type: 'succes', message: fr.drapeaux.toasts.succes }),
    onSettled: () => void clientRequetes.invalidateQueries({ queryKey: cleRequeteDrapeaux }),
  })

  function appliquer(cle: CleDrapeau, actif: boolean) {
    if (!session) return
    mutation.mutate({ cle, actif, modifiePar: session.user.id })
  }

  function basculer(cle: CleDrapeau, actif: boolean) {
    if (actif) setAConfirmer(cle)
    else appliquer(cle, false)
  }

  const lignes = new Map((requete.data ?? []).map((ligne) => [ligne.cle, ligne]))
  const cles = ordreClesDrapeaux.filter(estCleDrapeau)

  return (
    <div className="page">
      <header className="page-entete">
        <h1>{fr.drapeaux.titre}</h1>
        <p>{fr.drapeaux.intro}</p>
      </header>

      {requete.isPending ? (
        <p className="etat" role="status">
          {fr.commun.chargement}
        </p>
      ) : requete.isError ? (
        <div className="etat etat-erreur" role="alert">
          <p>{fr.drapeaux.erreurChargement}</p>
          <p className="mono">{requete.error.message}</p>
          <button
            type="button"
            className="bouton bouton-secondaire"
            onClick={() => void requete.refetch()}
          >
            {fr.commun.reessayer}
          </button>
        </div>
      ) : lignes.size === 0 ? (
        <p className="etat">{fr.drapeaux.vide}</p>
      ) : (
        <div className={`carte ${styles.liste}`}>
          {cles.map((cle) => {
            const ligne = lignes.get(cle)
            const textes = fr.drapeaux.items[cle]
            const actif = ligne?.actif === true
            const enCours = mutation.isPending && mutation.variables?.cle === cle
            return (
              <div key={cle} className={styles.ligne}>
                <div>
                  <h2 className={styles.nom}>{textes.nom}</h2>
                  <p className={styles.description}>{textes.description}</p>
                </div>
                <div className={styles.etat}>
                  <span className={actif ? styles.badgeEnLigne : styles.badgeHorsLigne}>
                    {ligne
                      ? actif
                        ? fr.drapeaux.etats.enLigne
                        : fr.drapeaux.etats.horsLigne
                      : fr.drapeaux.etats.absent}
                  </span>
                  <Interrupteur
                    actif={actif}
                    libelle={fr.drapeaux.basculer(textes.objet)}
                    disabled={!ligne || enCours}
                    onChange={(valeur) => basculer(cle, valeur)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <DialogueConfirmation
        ouvert={aConfirmer !== null}
        titre={aConfirmer ? fr.drapeaux.confirmationTitre(fr.drapeaux.items[aConfirmer].objet) : ''}
        message={aConfirmer ? fr.drapeaux.items[aConfirmer].confirmation : ''}
        libelleConfirmer={fr.commun.continuer}
        libelleAnnuler={fr.commun.annuler}
        onConfirmer={() => {
          if (aConfirmer) appliquer(aConfirmer, true)
          setAConfirmer(null)
        }}
        onAnnuler={() => setAConfirmer(null)}
      />
    </div>
  )
}
