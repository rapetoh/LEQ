import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { useSession } from '../../auth/sessionContext'
import { BarreOutils, Echec, Squelette, Vide } from '../../composants/Etats'
import { useNotifier } from '../../composants/toastContext'
import { ordreClesConfiguration } from '../../domaine'
import { fr } from '../../fr'
import type { EntreeConfiguration } from '../../modele/configuration'
import {
  chargerConfiguration,
  cleRequeteConfiguration,
  enregistrerConfiguration,
} from '../../services/configuration'
import { LigneConfiguration } from './LigneConfiguration'
import { SECTIONS, sectionDeCle, trierCles, type Section } from './sections'
import { validerSaisie, type Saisie } from './validation'
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

/** Matches a search against what the person reads, and against the key they may know. */
function correspond(ligne: EntreeConfiguration, recherche: string): boolean {
  if (recherche.trim() === '') return true
  const terme = recherche.trim().toLowerCase()
  return (
    ligne.cle.toLowerCase().includes(terme) ||
    (ligne.description ?? '').toLowerCase().includes(terme)
  )
}

/**
 * The values the application reads at startup. Everything is edited on the page and saved in
 * one gesture: a save button on each of twenty-four rows made changing a rhythm feel like
 * twenty-four decisions.
 */
export function Configuration() {
  const { session } = useSession()
  const notifier = useNotifier()
  const clientRequetes = useQueryClient()
  const requete = useQuery({ queryKey: cleRequeteConfiguration, queryFn: chargerConfiguration })

  const [modifications, setModifications] = useState<Record<string, Saisie>>({})
  const [recherche, setRecherche] = useState('')

  const lignes = useMemo(() => requete.data ?? [], [requete.data])
  const parCle = useMemo(() => new Map(lignes.map((l) => [l.cle, l])), [lignes])
  const clesModifiees = Object.keys(modifications)

  const invalide = clesModifiees.some((cle) => {
    const ligne = parCle.get(cle)
    const saisie = modifications[cle]
    return ligne && saisie !== undefined && !validerSaisie(ligne.cle, ligne.type, saisie).ok
  })

  const enregistrement = useMutation({
    // Each value is its own row and its own write; there is no transaction across them. So the
    // mutation never throws: it reports what was written and what was not, and the page keeps
    // exactly the edits that did not land. Saying "the previous value is restored" while two of
    // five were already live was worse than the failure itself.
    mutationFn: async () => {
      if (!session) throw new Error('Session absente')
      const ecrites: string[] = []
      const echouees: Array<{ cle: string; raison: string }> = []
      for (const cle of clesModifiees) {
        const ligne = parCle.get(cle)
        const saisie = modifications[cle]
        if (!ligne || saisie === undefined) continue
        const validation = validerSaisie(ligne.cle, ligne.type, saisie)
        if (!validation.ok) {
          echouees.push({ cle, raison: validation.erreur })
          continue
        }
        try {
          await enregistrerConfiguration({
            cle,
            valeur: validation.valeur,
            modifiePar: session.user.id,
          })
          ecrites.push(cle)
        } catch (erreur) {
          echouees.push({ cle, raison: erreur instanceof Error ? erreur.message : String(erreur) })
        }
      }
      return { ecrites, echouees }
    },
    onSuccess: ({ ecrites, echouees }) => {
      // What was written is no longer an edit; what failed stays on screen, still dirty.
      setModifications((courantes) => {
        const reste = { ...courantes }
        for (const cle of ecrites) delete reste[cle]
        return reste
      })
      if (echouees.length === 0) {
        notifier({ type: 'succes', message: fr.configuration.toasts.enregistrees(ecrites.length) })
      } else {
        notifier({
          type: 'erreur',
          message: fr.configuration.toasts.partiel(ecrites.length, echouees.length),
          details: echouees.map((e) => `${e.cle} : ${e.raison}`).join('\n'),
        })
      }
      void clientRequetes.invalidateQueries({ queryKey: cleRequeteConfiguration })
    },
    onError: (erreur: Error) => {
      notifier({ type: 'erreur', message: fr.configuration.toasts.erreur, details: erreur.message })
      void clientRequetes.invalidateQueries({ queryKey: cleRequeteConfiguration })
    },
  })

  const changer = (cle: string, saisie: Saisie | undefined) => {
    setModifications((courantes) => {
      const suivantes = { ...courantes }
      if (saisie === undefined) delete suivantes[cle]
      else suivantes[cle] = saisie
      return suivantes
    })
  }

  const visibles = lignes.filter((ligne) => correspond(ligne, recherche))

  return (
    <div className="page">
      <header className="page-entete">
        <h1>{fr.configuration.titre}</h1>
        <p>{fr.configuration.intro}</p>
      </header>

      <BarreOutils
        recherche={recherche}
        onRecherche={setRecherche}
        placeholder={fr.configuration.rechercher}
        compte={recherche.trim() ? fr.etats.resultats(visibles.length) : undefined}
      />

      {requete.isPending ? (
        <Squelette lignes={6} />
      ) : requete.isError ? (
        <Echec titre={fr.configuration.erreurChargement} detail={requete.error.message} />
      ) : lignes.length === 0 ? (
        <Vide marque="⚙" titre={fr.configuration.vide} />
      ) : visibles.length === 0 ? (
        <Vide marque="⌕" titre={fr.etats.aucunResultat} texte={fr.etats.aucunResultatTexte} />
      ) : (
        [...grouper(visibles).entries()]
          .sort(([a], [b]) => SECTIONS.indexOf(a) - SECTIONS.indexOf(b))
          .map(([section, lignesSection]) => (
            <section
              key={section}
              className={styles.section}
              aria-labelledby={`section-${section}`}
            >
              <h2 id={`section-${section}`}>{fr.configuration.sections[section]}</h2>
              <div className={`carte ${styles.tableau}`}>
                {lignesSection.map((ligne) => (
                  <LigneConfiguration
                    key={ligne.cle}
                    ligne={ligne}
                    saisie={modifications[ligne.cle]}
                    desactive={enregistrement.isPending}
                    onSaisie={changer}
                  />
                ))}
              </div>
            </section>
          ))
      )}

      {clesModifiees.length > 0 ? (
        <div className="barre-enregistrement" role="status">
          <p>{fr.configuration.aEnregistrer(clesModifiees.length)}</p>
          <div className="pousse" style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="bouton bouton-secondaire"
              disabled={enregistrement.isPending}
              onClick={() => setModifications({})}
            >
              {fr.commun.annuler}
            </button>
            <button
              type="button"
              className="bouton bouton-principal"
              disabled={enregistrement.isPending || invalide}
              onClick={() => enregistrement.mutate()}
            >
              {enregistrement.isPending
                ? fr.configuration.etats.enregistrement
                : fr.commun.enregistrer}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
