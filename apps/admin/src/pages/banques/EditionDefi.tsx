import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { DialogueConfirmation } from '../../composants/Dialogue'
import { useNotifier } from '../../composants/toastContext'
import { fr } from '../../fr'
import {
  prochainOrdre,
  saisieDepuisDefi,
  saisieVierge,
  type DefiEditable,
} from '../../modele/defis'
import {
  chargerDefis,
  chargerModelesActes,
  cleRequeteActes,
  cleRequeteDefis,
  creerDefi,
  modifierDefi,
} from '../../services/defis'
import { FormulaireDefi } from './FormulaireDefi'
import styles from './Banques.module.css'

type Confirmation = 'valider' | 'desactiver' | null

/** One défi: creation at /defis/nouveau, edition at /defis/:id, with validate and deactivate. */
export function EditionDefi() {
  const { id } = useParams<{ id: string }>()
  const creation = id === undefined
  const naviguer = useNavigate()
  const notifier = useNotifier()
  const clientRequetes = useQueryClient()
  const actes = useQuery({ queryKey: cleRequeteActes, queryFn: chargerModelesActes })
  const defis = useQuery({ queryKey: cleRequeteDefis, queryFn: chargerDefis })
  const [confirmation, setConfirmation] = useState<Confirmation>(null)

  const invalider = () => void clientRequetes.invalidateQueries({ queryKey: cleRequeteDefis })
  const messageErreur = (erreur: Error) =>
    /duplicate|unique|23505/i.test(erreur.message)
      ? fr.defis.edition.erreurDoublon
      : fr.defis.edition.erreur

  const creationMutation = useMutation({
    mutationFn: creerDefi,
    onSuccess: () => {
      invalider()
      notifier({ type: 'succes', message: fr.defis.edition.cree })
      void naviguer('/defis')
    },
    onError: (erreur: Error) =>
      notifier({ type: 'erreur', message: messageErreur(erreur), details: erreur.message }),
  })

  const modification = useMutation({
    mutationFn: modifierDefi,
    onSuccess: (_r, variables) => {
      invalider()
      notifier({ type: 'succes', message: fr.defis.edition.enregistre })
      if (
        !('provisoire' in variables.valeur && Object.keys(variables.valeur).length === 1) &&
        !('actif' in variables.valeur && Object.keys(variables.valeur).length === 1)
      ) {
        void naviguer('/defis')
      }
    },
    onError: (erreur: Error) =>
      notifier({ type: 'erreur', message: messageErreur(erreur), details: erreur.message }),
  })

  if (actes.isPending || defis.isPending) {
    return (
      <p className="etat" role="status">
        {fr.commun.chargement}
      </p>
    )
  }
  const erreur = actes.error ?? defis.error
  if (erreur) {
    return (
      <div className="etat etat-erreur" role="alert">
        <p>{fr.defis.erreurChargement}</p>
        <p className="mono">{erreur.message}</p>
      </div>
    )
  }

  const listeActes = actes.data ?? []
  const listeDefis = defis.data ?? []
  const defi = creation ? null : (listeDefis.find((d) => d.id === id) ?? null)
  if (!creation && !defi) {
    return (
      <div className="page">
        <p className="etat">{fr.defis.edition.introuvable}</p>
        <Link to="/defis" className="bouton bouton-secondaire">
          {fr.defis.edition.retour}
        </Link>
      </div>
    )
  }

  const premierActe = listeActes[0]?.ordre ?? 1
  const initiale = defi
    ? saisieDepuisDefi(defi)
    : saisieVierge(premierActe, prochainOrdre(listeDefis, premierActe))
  const enregistrement = creationMutation.isPending || modification.isPending

  function enregistrer(valeur: DefiEditable) {
    if (defi) modification.mutate({ id: defi.id, valeur })
    else creationMutation.mutate(valeur)
  }

  return (
    <div className="page">
      <header className={styles.entete}>
        <div>
          <h1>{creation ? fr.defis.edition.titreCreation : fr.defis.edition.titreModification}</h1>
          {defi ? <p className="mono">{defi.cle}</p> : null}
        </div>
        <div className={styles.actions}>
          {defi?.provisoire ? (
            <button
              type="button"
              className="bouton bouton-secondaire"
              disabled={enregistrement}
              onClick={() => setConfirmation('valider')}
            >
              {fr.defis.edition.marquerValide}
            </button>
          ) : null}
          {defi ? (
            defi.actif ? (
              <button
                type="button"
                className="bouton bouton-discret"
                disabled={enregistrement}
                onClick={() => setConfirmation('desactiver')}
              >
                {fr.defis.edition.desactiver}
              </button>
            ) : (
              <button
                type="button"
                className="bouton bouton-secondaire"
                disabled={enregistrement}
                onClick={() => modification.mutate({ id: defi.id, valeur: { actif: true } })}
              >
                {fr.defis.edition.reactiver}
              </button>
            )
          ) : null}
        </div>
      </header>

      <FormulaireDefi
        key={defi?.id ?? 'nouveau'}
        initiale={initiale}
        actes={listeActes}
        creation={creation}
        enregistrement={enregistrement}
        prochainOrdrePour={(ordreActe) => prochainOrdre(listeDefis, ordreActe)}
        onEnregistrer={enregistrer}
      />

      <DialogueConfirmation
        ouvert={confirmation !== null}
        titre={
          confirmation === 'valider'
            ? fr.defis.edition.marquerValideTitre
            : fr.defis.edition.desactiverTitre
        }
        message={
          confirmation === 'valider'
            ? fr.defis.edition.marquerValideMessage
            : fr.defis.edition.desactiverMessage
        }
        libelleConfirmer={fr.commun.continuer}
        libelleAnnuler={fr.commun.annuler}
        onConfirmer={() => {
          if (defi && confirmation === 'valider')
            modification.mutate({ id: defi.id, valeur: { provisoire: false } })
          if (defi && confirmation === 'desactiver')
            modification.mutate({ id: defi.id, valeur: { actif: false } })
          setConfirmation(null)
        }}
        onAnnuler={() => setConfirmation(null)}
      />
    </div>
  )
}
