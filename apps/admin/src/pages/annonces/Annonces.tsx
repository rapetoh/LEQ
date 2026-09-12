import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { CODES_REGION, NOMS_REGION, NouvelleAnnonceSchema, type CodeRegion } from '@leq/domaine'
import { ChampImage } from '../../composants/ChampImage'
import { Echec, Squelette, Vide } from '../../composants/Etats'
import { useNotifier } from '../../composants/toastContext'
import { fr } from '../../fr'
import {
  chargerAnnonces,
  chargerAnnoncesDuMois,
  chargerAteliers,
  cleRequeteAnnonces,
  cleRequeteAnnoncesDuMois,
  cleRequeteAteliers,
  ErreurAnnonce,
  publierAnnonce,
} from '../../services/annonces'
import { chargerConfiguration, cleRequeteConfiguration } from '../../services/configuration'
import { Champ } from '../banques/FormulaireDefi'
import { ApercuNotification } from './ApercuNotification'
import styles from '../banques/Banques.module.css'

function formaterDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

/** Compose and send an announcement; the cap and the filter are the database's. */
export function Annonces() {
  const id = useId()
  const notifier = useNotifier()
  const clientRequetes = useQueryClient()
  const annonces = useQuery({ queryKey: cleRequeteAnnonces, queryFn: chargerAnnonces })
  const duMois = useQuery({ queryKey: cleRequeteAnnoncesDuMois, queryFn: chargerAnnoncesDuMois })
  const ateliers = useQuery({ queryKey: cleRequeteAteliers, queryFn: chargerAteliers })
  const configuration = useQuery({
    queryKey: cleRequeteConfiguration,
    queryFn: chargerConfiguration,
  })
  const plafond = Number(
    configuration.data?.find((c) => c.cle === 'plafond_annonces_par_mois')?.valeur ?? 2,
  )

  const [titre, setTitre] = useState('')
  const [corps, setCorps] = useState('')
  const [atelierId, setAtelierId] = useState('')
  const [regions, setRegions] = useState<CodeRegion[]>([])
  const [image, setImage] = useState<string | null>(null)
  const [erreurs, setErreurs] = useState<Record<string, string>>({})

  const envoi = useMutation({
    mutationFn: publierAnnonce,
    onSuccess: () => {
      notifier({ type: 'succes', message: fr.annonces.envoyee })
      setTitre('')
      setCorps('')
      setAtelierId('')
      setRegions([])
      setImage(null)
      void clientRequetes.invalidateQueries({ queryKey: cleRequeteAnnonces })
      return clientRequetes.invalidateQueries({ queryKey: cleRequeteAnnoncesDuMois })
    },
    onError: (erreur: Error) => {
      const refus = erreur instanceof ErreurAnnonce ? erreur.refus : null
      notifier({
        type: 'erreur',
        message: refus ? fr.annonces.plafondAtteint : fr.annonces.erreur,
        details: erreur.message,
      })
      void clientRequetes.invalidateQueries({ queryKey: cleRequeteAnnoncesDuMois })
    },
  })

  const restantes = duMois.data === undefined ? null : Math.max(plafond - duMois.data, 0)

  function soumettre(e: React.FormEvent) {
    e.preventDefault()
    const lu = NouvelleAnnonceSchema.safeParse({
      titre,
      corps,
      atelier_id: atelierId || null,
      regions,
      image_chemin: image,
    })
    if (!lu.success) {
      const prochaines: Record<string, string> = {}
      for (const probleme of lu.error.issues)
        prochaines[String(probleme.path[0])] = fr.annonces.erreurChamp
      setErreurs(prochaines)
      return
    }
    setErreurs({})
    envoi.mutate(lu.data)
  }

  return (
    <div className="page">
      <header className={styles.entete}>
        <div>
          <h1>{fr.annonces.titre}</h1>
          <p>{fr.annonces.intro}</p>
        </div>
        {restantes !== null ? (
          <span className={restantes === 0 ? styles.badgeInactif : styles.badgeValide}>
            {fr.annonces.compteur(duMois.data ?? 0, plafond)}
          </span>
        ) : null}
      </header>

      <div className="deux-colonnes">
        <form className={`carte ${styles.formulaire}`} noValidate onSubmit={soumettre}>
          <Champ
            id={`${id}-titre`}
            libelle={fr.annonces.champs.titre}
            aide={fr.annonces.champs.titreAide}
            erreur={erreurs.titre ?? null}
          >
            <input
              id={`${id}-titre`}
              className="champ"
              value={titre}
              maxLength={80}
              onChange={(e) => setTitre(e.target.value)}
              aria-invalid={erreurs.titre ? 'true' : undefined}
            />
          </Champ>
          <Champ
            id={`${id}-corps`}
            libelle={fr.annonces.champs.corps}
            aide={fr.annonces.champs.corpsAide}
            erreur={erreurs.corps ?? null}
          >
            <textarea
              id={`${id}-corps`}
              className="champ"
              rows={3}
              value={corps}
              maxLength={240}
              onChange={(e) => setCorps(e.target.value)}
              aria-invalid={erreurs.corps ? 'true' : undefined}
            />
          </Champ>
          <ChampImage
            usage="annonces"
            valeur={image}
            onChange={setImage}
            libelle={fr.annonces.champs.image}
            aide={fr.annonces.champs.imageAide}
          />
          <div className={styles.grilleChamps}>
            <Champ
              id={`${id}-atelier`}
              libelle={fr.annonces.champs.atelier}
              aide={fr.annonces.champs.atelierAide}
            >
              <select
                id={`${id}-atelier`}
                className="champ"
                value={atelierId}
                onChange={(e) => setAtelierId(e.target.value)}
              >
                <option value="">{fr.annonces.champs.sansAtelier}</option>
                {(ateliers.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.titre} · {formaterDate(a.date_debut)}
                  </option>
                ))}
              </select>
            </Champ>
          </div>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="etiquette">{fr.annonces.champs.regions}</legend>
            <p className={styles.aide}>{fr.annonces.champs.regionsAide}</p>
            <div className={styles.formulaireInline}>
              {CODES_REGION.map((code) => {
                const coche = regions.includes(code)
                return (
                  <label
                    key={code}
                    className={`bouton ${coche ? 'bouton-principal' : 'bouton-secondaire'}`}
                    style={{ cursor: 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      checked={coche}
                      onChange={() =>
                        setRegions((r) => (coche ? r.filter((c) => c !== code) : [...r, code]))
                      }
                      style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                    />
                    {NOMS_REGION[code]}
                  </label>
                )
              })}
            </div>
          </fieldset>
          <div className={styles.piedFormulaire}>
            <div>
              <button
                type="submit"
                className="bouton bouton-principal"
                disabled={envoi.isPending || restantes === 0}
              >
                {fr.annonces.envoyer}
              </button>
            </div>
            <p className={styles.aide}>
              {regions.length === 0
                ? fr.annonces.toutLeMonde
                : fr.annonces.nbRegions(regions.length)}
            </p>
          </div>
        </form>
        <ApercuNotification titre={titre} corps={corps} image={image} />
      </div>

      <section aria-labelledby="historique-annonces" style={{ marginTop: 24 }}>
        <h2 id="historique-annonces" style={{ marginBottom: 10 }}>
          {fr.annonces.historique}
        </h2>
        {annonces.isPending ? (
          <Squelette lignes={2} />
        ) : annonces.isError ? (
          <Echec titre={fr.annonces.erreurChargement} detail={annonces.error.message} />
        ) : annonces.data.length === 0 ? (
          <Vide marque="✉" titre={fr.annonces.vide} texte={fr.annonces.videTexte} />
        ) : (
          <div className={`carte ${styles.liste}`}>
            {annonces.data.map((a) => (
              <div key={a.id} className={styles.ligne}>
                <span className={styles.ordre}>{formaterDate(a.envoyee_le)}</span>
                <div>
                  <span className={styles.titre}>{a.titre}</span>
                  <p className={styles.detail}>
                    {a.corps} ·{' '}
                    {a.regions === null
                      ? fr.annonces.toutLeMonde
                      : a.regions.map((r) => NOMS_REGION[r]).join(', ')}
                  </p>
                </div>
                <div className={styles.badges}>
                  <span className={a.destinataires === null ? styles.badge : styles.badgeValide}>
                    {a.destinataires === null
                      ? fr.annonces.enCours
                      : fr.annonces.bilan(a.envoyes, a.destinataires, a.echecs)}
                  </span>
                </div>
                <div />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
