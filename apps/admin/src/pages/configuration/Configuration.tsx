import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '../../auth/sessionContext'
import { useNotifier } from '../../composants/toastContext'
import { ordreClesConfiguration } from '../../domaine'
import { fr } from '../../fr'
import type { EntreeConfiguration } from '../../modele/configuration'
import {
  chargerConfiguration,
  cleRequeteConfiguration,
  enregistrerConfiguration,
  type ModificationConfiguration,
} from '../../services/configuration'
import { LigneConfiguration } from './LigneConfiguration'
import { SECTIONS, sectionDeCle, trierCles, type Section } from './sections'
import styles from './Configuration.module.css'

function grouper(lignes: readonly EntreeConfiguration[]): Map<Section, EntreeConfiguration[]> {
  const parCle = new Map(lignes.map((ligne) => [ligne.cle, ligne]))
  const cles = trierCles(
    lignes.map((ligne) => ligne.cle),
    ordreClesConfiguration,
  )
  const groupes = new Map<Section, EntreeConfiguration[]>()
  for (const cle of cles) {
    const ligne = parCle.get(cle)
    if (!ligne) continue
    const section = sectionDeCle(cle)
    const liste = groupes.get(section) ?? []
    liste.push(ligne)
    groupes.set(section, liste)
  }
  return groupes
}

/** The configuration table: one editable row per key, saved row by row. */
export function Configuration() {
  const { session } = useSession()
  const notifier = useNotifier()
  const clientRequetes = useQueryClient()

  const requete = useQuery({ queryKey: cleRequeteConfiguration, queryFn: chargerConfiguration })

  const mutation = useMutation({
    mutationFn: enregistrerConfiguration,
    onMutate: async (modification: ModificationConfiguration) => {
      await clientRequetes.cancelQueries({ queryKey: cleRequeteConfiguration })
      const precedent = clientRequetes.getQueryData<EntreeConfiguration[]>(cleRequeteConfiguration)
      clientRequetes.setQueryData<EntreeConfiguration[]>(cleRequeteConfiguration, (lignes) =>
        lignes?.map((ligne) =>
          ligne.cle === modification.cle ? { ...ligne, valeur: modification.valeur } : ligne,
        ),
      )
      return { precedent }
    },
    onError: (erreur: Error, _modification, contexte) => {
      if (contexte?.precedent) {
        clientRequetes.setQueryData(cleRequeteConfiguration, contexte.precedent)
      }
      notifier({ type: 'erreur', message: fr.configuration.toasts.erreur, details: erreur.message })
    },
    onSuccess: (_resultat, modification) => {
      notifier({ type: 'succes', message: fr.configuration.toasts.succes(modification.cle) })
    },
    onSettled: () => void clientRequetes.invalidateQueries({ queryKey: cleRequeteConfiguration }),
  })

  function enregistrer(cle: string, valeur: unknown) {
    if (!session) return
    mutation.mutate({ cle, valeur, modifiePar: session.user.id })
  }

  return (
    <div className="page">
      <header className="page-entete">
        <h1>{fr.configuration.titre}</h1>
        <p>{fr.configuration.intro}</p>
      </header>

      {requete.isPending ? (
        <p className="etat" role="status">
          {fr.commun.chargement}
        </p>
      ) : requete.isError ? (
        <div className="etat etat-erreur" role="alert">
          <p>{fr.configuration.erreurChargement}</p>
          <p className="mono">{requete.error.message}</p>
          <button
            type="button"
            className="bouton bouton-secondaire"
            onClick={() => void requete.refetch()}
          >
            {fr.commun.reessayer}
          </button>
        </div>
      ) : requete.data.length === 0 ? (
        <p className="etat">{fr.configuration.vide}</p>
      ) : (
        [...grouper(requete.data).entries()]
          .sort(([a], [b]) => SECTIONS.indexOf(a) - SECTIONS.indexOf(b))
          .map(([section, lignes]) => (
            <section
              key={section}
              className={styles.section}
              aria-labelledby={`section-${section}`}
            >
              <h2 id={`section-${section}`}>{fr.configuration.sections[section]}</h2>
              <div className={`carte ${styles.tableau}`}>
                {lignes.map((ligne) => (
                  <LigneConfiguration
                    key={ligne.cle}
                    ligne={ligne}
                    enregistrement={mutation.isPending && mutation.variables?.cle === ligne.cle}
                    onEnregistrer={enregistrer}
                  />
                ))}
              </div>
            </section>
          ))
      )}
    </div>
  )
}
