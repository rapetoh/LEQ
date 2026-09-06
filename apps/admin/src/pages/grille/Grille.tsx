import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useSession } from '../../auth/sessionContext'
import { DialogueConfirmation } from '../../composants/Dialogue'
import { useNotifier } from '../../composants/toastContext'
import { fr } from '../../fr'
import {
  saisieCritereVierge,
  saisieDepuisCritere,
  type CritereEditable,
  type CritereGrille,
} from '../../modele/grille'
import {
  chargerGrilles,
  cleRequeteGrilles,
  creerCritere,
  creerVersion,
  modifierCritere,
  publierGrille,
  supprimerCritere,
  type GrilleAvecCriteres,
} from '../../services/grille'
import { FormulaireCritere } from './FormulaireCritere'
import styles from '../banques/Banques.module.css'

function formaterDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

/**
 * Rebecca's grid, versioned. A draft is edited criterion by criterion; publishing is one-way and
 * the worker scores every new take with the most recent published version from then on.
 */
export function Grille() {
  const { session } = useSession()
  const notifier = useNotifier()
  const clientRequetes = useQueryClient()
  const grilles = useQuery({ queryKey: cleRequeteGrilles, queryFn: chargerGrilles })
  const [choisie, setChoisie] = useState<string | null>(null)
  const [edition, setEdition] = useState<string | null>(null)
  const [aPublier, setAPublier] = useState<GrilleAvecCriteres | null>(null)
  const [aSupprimer, setASupprimer] = useState<CritereGrille | null>(null)

  const invalider = () => clientRequetes.invalidateQueries({ queryKey: cleRequeteGrilles })
  const erreur = (message: string) => (e: Error) =>
    notifier({ type: 'erreur', message, details: e.message })

  const nouvelleVersion = useMutation({
    mutationFn: (depuis: GrilleAvecCriteres | null) =>
      creerVersion({ depuis, notes: null, creePar: session?.user.id ?? '' }),
    onSuccess: (grille) => {
      notifier({ type: 'succes', message: fr.grille.versionCreee(grille.version) })
      setChoisie(grille.id)
      return invalider()
    },
    onError: erreur(fr.grille.erreur),
  })
  const creation = useMutation({
    mutationFn: ({ grilleId, valeur }: { grilleId: string; valeur: CritereEditable }) =>
      creerCritere(grilleId, valeur),
    onSuccess: () => {
      notifier({ type: 'succes', message: fr.grille.critereEnregistre })
      setEdition(null)
      return invalider()
    },
    onError: erreur(fr.grille.erreur),
  })
  const modification = useMutation({
    mutationFn: ({ id, valeur }: { id: string; valeur: CritereEditable }) =>
      modifierCritere(id, valeur),
    onSuccess: () => {
      notifier({ type: 'succes', message: fr.grille.critereEnregistre })
      setEdition(null)
      return invalider()
    },
    onError: erreur(fr.grille.erreur),
  })
  const suppression = useMutation({
    mutationFn: supprimerCritere,
    onSuccess: () => {
      notifier({ type: 'succes', message: fr.grille.critereSupprime })
      return invalider()
    },
    onError: erreur(fr.grille.erreur),
  })
  const publication = useMutation({
    mutationFn: publierGrille,
    onSuccess: () => {
      notifier({ type: 'succes', message: fr.grille.publiee })
      return invalider()
    },
    onError: erreur(fr.grille.erreur),
  })

  if (grilles.isPending) {
    return (
      <p className="etat" role="status">
        {fr.commun.chargement}
      </p>
    )
  }
  if (grilles.isError) {
    return (
      <div className="etat etat-erreur" role="alert">
        <p>{fr.grille.erreurChargement}</p>
        <p className="mono">{grilles.error.message}</p>
      </div>
    )
  }

  const liste = grilles.data
  const publiee = liste.find((g) => g.publiee_le !== null) ?? null
  const grille = liste.find((g) => g.id === choisie) ?? liste[0] ?? null
  const brouillon = grille !== null && grille.publiee_le === null
  const enregistrement = creation.isPending || modification.isPending

  return (
    <div className="page">
      <header className={styles.entete}>
        <div>
          <h1>{fr.grille.titre}</h1>
          <p>{fr.grille.intro}</p>
        </div>
        <button
          type="button"
          className="bouton bouton-principal"
          disabled={nouvelleVersion.isPending}
          onClick={() => nouvelleVersion.mutate(grille)}
        >
          {grille ? fr.grille.nouvelleVersionDepuis(grille.version) : fr.grille.premiereVersion}
        </button>
      </header>

      {liste.length === 0 ? (
        <p className="etat">{fr.grille.vide}</p>
      ) : (
        <div className={styles.formulaireInline} style={{ marginBottom: 16 }}>
          {liste.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`bouton ${grille?.id === g.id ? 'bouton-principal' : 'bouton-secondaire'}`}
              aria-pressed={grille?.id === g.id}
              onClick={() => {
                setChoisie(g.id)
                setEdition(null)
              }}
            >
              {fr.grille.version(g.version)}
              {g.publiee_le
                ? ` · ${fr.grille.publieeLe(formaterDate(g.publiee_le))}`
                : ` · ${fr.grille.brouillon}`}
            </button>
          ))}
        </div>
      )}

      {grille ? (
        <section aria-labelledby="grille-courante">
          <div className={styles.acteEntete}>
            <div className={styles.acteTitres}>
              <h2 id="grille-courante">{fr.grille.version(grille.version)}</h2>
              <span className={grille.publiee_le ? styles.badgeValide : styles.badge}>
                {grille.publiee_le ? fr.grille.publieeCourte : fr.grille.brouillon}
              </span>
              {publiee?.id === grille.id ? (
                <span className={styles.compte}>{fr.grille.enService}</span>
              ) : null}
              <span className={styles.compte}>{fr.grille.nbCriteres(grille.criteres.length)}</span>
            </div>
            {brouillon ? (
              <div className={styles.actions}>
                <button
                  type="button"
                  className="bouton bouton-secondaire"
                  disabled={edition === 'nouveau'}
                  onClick={() => setEdition('nouveau')}
                >
                  {fr.grille.ajouterCritere}
                </button>
                <button
                  type="button"
                  className="bouton bouton-principal"
                  disabled={grille.criteres.length === 0 || publication.isPending}
                  onClick={() => setAPublier(grille)}
                >
                  {fr.grille.publier}
                </button>
              </div>
            ) : null}
          </div>

          {!brouillon ? <p className={styles.aide}>{fr.grille.lectureSeule}</p> : null}

          {edition === 'nouveau' && brouillon ? (
            <div style={{ marginBottom: 16 }}>
              <FormulaireCritere
                initiale={saisieCritereVierge()}
                ordre={grille.criteres.length + 1}
                enregistrement={enregistrement}
                onEnregistrer={(valeur) => creation.mutate({ grilleId: grille.id, valeur })}
                onAnnuler={() => setEdition(null)}
              />
            </div>
          ) : null}

          <div className={`carte ${styles.liste}`}>
            {grille.criteres.length === 0 ? (
              <p className={styles.vide}>{fr.grille.aucunCritere}</p>
            ) : null}
            {grille.criteres.map((critere) =>
              edition === critere.id && brouillon ? (
                <div key={critere.id} style={{ padding: 4 }}>
                  <FormulaireCritere
                    initiale={saisieDepuisCritere(critere)}
                    ordre={critere.ordre}
                    enregistrement={enregistrement}
                    onEnregistrer={(valeur) => modification.mutate({ id: critere.id, valeur })}
                    onAnnuler={() => setEdition(null)}
                  />
                </div>
              ) : (
                <div key={critere.id} className={styles.ligne}>
                  <span className={styles.ordre}>{critere.ordre}</span>
                  <div>
                    <span className={styles.titre}>{critere.nom}</span>
                    <p className={styles.detail}>
                      <span className="mono">{critere.cle}</span> ·{' '}
                      {fr.grille.surMax(critere.regle.score_max)} ·{' '}
                      {fr.grille.nbElements(critere.regle.elements.length)} · {critere.definition}
                    </p>
                  </div>
                  <div className={styles.badges}>
                    {critere.regle.elements.map((e) => (
                      <span key={e.mesure} className={`${styles.badgeInactif} mono`}>
                        {e.mesure}
                      </span>
                    ))}
                  </div>
                  <div className={styles.actions}>
                    {brouillon ? (
                      <>
                        <button
                          type="button"
                          className="bouton bouton-secondaire"
                          onClick={() => setEdition(critere.id)}
                        >
                          {fr.grille.modifier}
                        </button>
                        <button
                          type="button"
                          className="bouton bouton-discret"
                          onClick={() => setASupprimer(critere)}
                        >
                          {fr.grille.supprimer}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              ),
            )}
          </div>
        </section>
      ) : null}

      <DialogueConfirmation
        ouvert={aPublier !== null}
        titre={aPublier ? fr.grille.publierTitre(aPublier.version) : ''}
        message={fr.grille.publierMessage}
        libelleConfirmer={fr.grille.publier}
        libelleAnnuler={fr.commun.annuler}
        onConfirmer={() => {
          if (aPublier) publication.mutate(aPublier.id)
          setAPublier(null)
        }}
        onAnnuler={() => setAPublier(null)}
      />
      <DialogueConfirmation
        ouvert={aSupprimer !== null}
        titre={aSupprimer ? fr.grille.supprimerTitre(aSupprimer.nom) : ''}
        message={fr.grille.supprimerMessage}
        libelleConfirmer={fr.grille.supprimer}
        libelleAnnuler={fr.commun.annuler}
        onConfirmer={() => {
          if (aSupprimer) suppression.mutate(aSupprimer.id)
          setASupprimer(null)
        }}
        onAnnuler={() => setASupprimer(null)}
      />
    </div>
  )
}
