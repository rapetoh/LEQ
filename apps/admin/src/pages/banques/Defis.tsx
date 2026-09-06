import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { useNotifier } from '../../composants/toastContext'
import { fr } from '../../fr'
import {
  grouperParActe,
  minutesDe,
  voisinPourEchange,
  type Defi,
  type GroupeActe,
  type ModeleActe,
} from '../../modele/defis'
import {
  chargerDefis,
  chargerModelesActes,
  cleRequeteActes,
  cleRequeteDefis,
  echangerOrdreDefis,
  enregistrerModeleActe,
  type ModeleActeEditable,
} from '../../services/defis'
import styles from './Banques.module.css'

/** The bank of défis, act by act: reorder, rename an act, open a défi, create one. */
export function Defis() {
  const notifier = useNotifier()
  const clientRequetes = useQueryClient()
  const actes = useQuery({ queryKey: cleRequeteActes, queryFn: chargerModelesActes })
  const defis = useQuery({ queryKey: cleRequeteDefis, queryFn: chargerDefis })
  const [nouvelActe, setNouvelActe] = useState(false)

  const echange = useMutation({
    mutationFn: ({ a, b }: { a: string; b: string }) => echangerOrdreDefis(a, b),
    onSuccess: () => notifier({ type: 'succes', message: fr.defis.ordreEchange }),
    onError: (erreur: Error) =>
      notifier({ type: 'erreur', message: fr.defis.erreurOrdre, details: erreur.message }),
    onSettled: () => void clientRequetes.invalidateQueries({ queryKey: cleRequeteDefis }),
  })

  const acte = useMutation({
    mutationFn: enregistrerModeleActe,
    onSuccess: () => {
      notifier({ type: 'succes', message: fr.defis.acteEnregistre })
      setNouvelActe(false)
    },
    onError: (erreur: Error) =>
      notifier({ type: 'erreur', message: fr.defis.edition.erreur, details: erreur.message }),
    onSettled: () => void clientRequetes.invalidateQueries({ queryKey: cleRequeteActes }),
  })

  function deplacer(defi: Defi, direction: 'haut' | 'bas') {
    const voisin = voisinPourEchange(defis.data ?? [], defi.id, direction)
    if (voisin) echange.mutate({ a: defi.id, b: voisin.id })
  }

  const chargement = actes.isPending || defis.isPending
  const erreur = actes.error ?? defis.error
  const groupes = actes.data && defis.data ? grouperParActe(actes.data, defis.data) : []
  const prochainActe = (actes.data ?? []).reduce((max, a) => Math.max(max, a.ordre), 0) + 1

  return (
    <div className="page">
      <header className={styles.entete}>
        <div>
          <h1>{fr.defis.titre}</h1>
          <p>{fr.defis.intro}</p>
        </div>
        <Link to="/defis/nouveau" className="bouton bouton-principal">
          {fr.defis.creer}
        </Link>
      </header>

      {chargement ? (
        <p className="etat" role="status">
          {fr.commun.chargement}
        </p>
      ) : erreur ? (
        <div className="etat etat-erreur" role="alert">
          <p>{fr.defis.erreurChargement}</p>
          <p className="mono">{erreur.message}</p>
          <button
            type="button"
            className="bouton bouton-secondaire"
            onClick={() => {
              void actes.refetch()
              void defis.refetch()
            }}
          >
            {fr.commun.reessayer}
          </button>
        </div>
      ) : (
        <>
          {groupes.length === 0 ? <p className="etat">{fr.defis.vide}</p> : null}
          {groupes.map((groupe) => (
            <Acte
              key={groupe.acte.ordre}
              groupe={groupe}
              enCours={echange.isPending}
              onDeplacer={deplacer}
              onRenommer={(valeur) => acte.mutate(valeur)}
            />
          ))}
          {nouvelActe ? (
            <FormulaireActe
              ordre={prochainActe}
              enregistrement={acte.isPending}
              onEnregistrer={(valeur) => acte.mutate(valeur)}
              onAnnuler={() => setNouvelActe(false)}
            />
          ) : (
            <button
              type="button"
              className="bouton bouton-secondaire"
              onClick={() => setNouvelActe(true)}
            >
              {fr.defis.ajouterActe}
            </button>
          )}
        </>
      )}
    </div>
  )
}

function Acte({
  groupe,
  enCours,
  onDeplacer,
  onRenommer,
}: {
  groupe: GroupeActe
  enCours: boolean
  onDeplacer: (defi: Defi, direction: 'haut' | 'bas') => void
  onRenommer: (valeur: ModeleActeEditable) => void
}) {
  const [renommage, setRenommage] = useState(false)
  const { acte, defis } = groupe
  return (
    <section className={styles.acte} aria-labelledby={`acte-${acte.ordre}`}>
      <div className={styles.acteEntete}>
        {renommage ? (
          <FormulaireActe
            acte={acte}
            ordre={acte.ordre}
            enregistrement={false}
            onEnregistrer={(valeur) => {
              onRenommer(valeur)
              setRenommage(false)
            }}
            onAnnuler={() => setRenommage(false)}
          />
        ) : (
          <>
            <div className={styles.acteTitres}>
              <span className={styles.acteNumero}>{fr.defis.acte(acte.ordre)}</span>
              <h2 id={`acte-${acte.ordre}`}>{acte.titre}</h2>
              {acte.sous_titre ? (
                <span className={styles.acteSousTitre}>{acte.sous_titre}</span>
              ) : null}
              <span className={styles.compte}>{fr.defis.nombreDefis(defis.length)}</span>
            </div>
            <button
              type="button"
              className="bouton bouton-discret"
              onClick={() => setRenommage(true)}
            >
              {fr.defis.renommer}
            </button>
          </>
        )}
      </div>
      <div className={`carte ${styles.liste}`}>
        {defis.length === 0 ? <p className={styles.vide}>{fr.defis.aucunDefi}</p> : null}
        {defis.map((defi, index) => (
          <div
            key={defi.id}
            className={`${styles.ligne} ${defi.actif ? '' : styles.ligneInactive}`}
          >
            <span className={styles.ordre}>{defi.ordre}</span>
            <div>
              <Link to={`/defis/${defi.id}`} className={styles.titre}>
                {defi.titre}
              </Link>
              <p className={styles.detail}>
                {fr.banques.formats[defi.format]} ·{' '}
                {fr.defis.resume(minutesDe(defi.duree_max_s), defi.points)} ·{' '}
                {fr.defis.seuil(String(defi.seuil_reussite).replace('.', ','))} · {defi.competence}
              </p>
            </div>
            <div className={styles.badges}>
              {defi.provisoire ? (
                <span className={styles.badge}>{fr.banques.badges.provisoire}</span>
              ) : (
                <span className={styles.badgeValide}>{fr.banques.badges.valide}</span>
              )}
              {defi.actif ? null : (
                <span className={styles.badgeInactif}>{fr.banques.badges.inactif}</span>
              )}
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                className="bouton bouton-discret"
                aria-label={fr.defis.monter(defi.titre)}
                disabled={enCours || index === 0}
                onClick={() => onDeplacer(defi, 'haut')}
              >
                ↑
              </button>
              <button
                type="button"
                className="bouton bouton-discret"
                aria-label={fr.defis.descendre(defi.titre)}
                disabled={enCours || index === defis.length - 1}
                onClick={() => onDeplacer(defi, 'bas')}
              >
                ↓
              </button>
              <Link to={`/defis/${defi.id}`} className="bouton bouton-secondaire">
                {fr.defis.modifier}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function FormulaireActe({
  acte,
  ordre,
  enregistrement,
  onEnregistrer,
  onAnnuler,
}: {
  acte?: ModeleActe
  ordre: number
  enregistrement: boolean
  onEnregistrer: (valeur: ModeleActeEditable) => void
  onAnnuler: () => void
}) {
  const [titre, setTitre] = useState(acte?.titre ?? '')
  const [sousTitre, setSousTitre] = useState(acte?.sous_titre ?? '')
  const valide = titre.trim() !== ''
  return (
    <form
      className={styles.formulaireInline}
      onSubmit={(e) => {
        e.preventDefault()
        if (!valide) return
        onEnregistrer({ ordre, titre: titre.trim(), sous_titre: sousTitre.trim() || null })
      }}
    >
      <span className={styles.acteNumero}>{fr.defis.acte(ordre)}</span>
      <input
        className="champ"
        aria-label={fr.defis.acteTitre}
        placeholder={fr.defis.acteTitre}
        value={titre}
        onChange={(e) => setTitre(e.target.value)}
      />
      <input
        className="champ"
        aria-label={fr.defis.acteSousTitre}
        placeholder={fr.defis.acteSousTitre}
        value={sousTitre}
        onChange={(e) => setSousTitre(e.target.value)}
      />
      <button
        type="submit"
        className="bouton bouton-principal"
        disabled={!valide || enregistrement}
      >
        {fr.commun.enregistrer}
      </button>
      <button type="button" className="bouton bouton-discret" onClick={onAnnuler}>
        {fr.commun.annuler}
      </button>
    </form>
  )
}
