import { useQuery } from '@tanstack/react-query'
import { Echec, Squelette, Vide } from '../composants/Etats'
import { fr } from '../fr'
import {
  chargerResumeAbonnements,
  cleRequeteAbonnements,
  type ResumeAbonnements,
} from '../services/abonnements'
import styles from './Abonnements.module.css'

const formaterMontant = (montant: number, devise: string) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: devise }).format(montant)
const formaterMontants = (montants: Record<string, number>) => {
  const parts = Object.entries(montants).map(([devise, m]) => formaterMontant(m, devise))
  return parts.length === 0 ? '' : parts.join(' · ')
}
const formaterMois = (mois: string) =>
  new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(
    new Date(`${mois}-01T12:00:00`),
  )
const formaterDate = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )

/** Who is on a paid tier, what came in each month, and the last payments one by one. */
export function Abonnements() {
  const resume = useQuery({ queryKey: cleRequeteAbonnements, queryFn: chargerResumeAbonnements })
  const a = fr.abonnements

  return (
    <div className="page">
      <header className="page-entete">
        <h1>{a.titre}</h1>
        <p>{a.intro}</p>
      </header>

      {resume.isPending ? (
        <Squelette lignes={4} />
      ) : resume.isError ? (
        <Echec titre={a.erreurChargement} detail={resume.error.message} />
      ) : (
        <Contenu resume={resume.data} />
      )}
    </div>
  )
}

function Contenu({ resume }: { resume: ResumeAbonnements }) {
  const a = fr.abonnements
  const moisAvecActivite = resume.mois.filter(
    (m) => m.nouveaux > 0 || m.paiements > 0 || m.remboursements > 0,
  )
  return (
    <>
      <section aria-labelledby="titre-actifs" className={styles.section}>
        <h2 id="titre-actifs">{a.actifs.titre}</h2>
        <p className={styles.sousTitre}>{a.actifs.intro}</p>
        <div className={styles.chiffres}>
          <Chiffre valeur={resume.actifs.total} libelle={a.actifs.total} />
          {resume.actifs.par_formule.map((f) => (
            <Chiffre key={f.cle} valeur={f.actifs} libelle={f.nom} />
          ))}
        </div>
      </section>

      <section aria-labelledby="titre-mois" className={styles.section}>
        <h2 id="titre-mois">{a.mois.titre}</h2>
        <p className={styles.sousTitre}>{a.mois.intro}</p>
        {moisAvecActivite.length === 0 ? (
          <Vide marque="◆" titre={a.mois.vide} />
        ) : (
          <div className="carte">
            <table className={styles.tableau}>
              <thead>
                <tr>
                  <th>{a.mois.mois}</th>
                  <th className={styles.nombre}>{a.mois.nouveaux}</th>
                  <th className={styles.nombre}>{a.mois.paiements}</th>
                  <th className={styles.nombre}>{a.mois.montant}</th>
                  <th className={styles.nombre}>{a.mois.net}</th>
                  <th className={styles.nombre}>{a.mois.remboursements}</th>
                </tr>
              </thead>
              <tbody>
                {moisAvecActivite.map((m) => (
                  <tr key={m.mois}>
                    <td>{formaterMois(m.mois)}</td>
                    <td className={styles.nombre}>{m.nouveaux}</td>
                    <td className={styles.nombre}>{m.paiements}</td>
                    <td className={styles.nombre}>{formaterMontants(m.montants)}</td>
                    <td className={`${styles.nombre} ${styles.calme}`}>
                      {formaterMontants(m.net) || a.mois.netInconnu}
                    </td>
                    <td className={styles.nombre}>{m.remboursements}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="titre-derniers" className={styles.section}>
        <h2 id="titre-derniers">{a.derniers.titre}</h2>
        <p className={styles.sousTitre}>{a.derniers.intro}</p>
        {resume.derniers.length === 0 ? (
          <Vide marque="◆" titre={a.derniers.vide} />
        ) : (
          <div className="carte">
            <table className={styles.tableau}>
              <thead>
                <tr>
                  <th>{a.derniers.date}</th>
                  <th>{a.derniers.personne}</th>
                  <th>{a.derniers.formule}</th>
                  <th>{a.derniers.type}</th>
                  <th>{a.derniers.magasin}</th>
                  <th className={styles.nombre}>{a.derniers.montant}</th>
                </tr>
              </thead>
              <tbody>
                {resume.derniers.map((p) => (
                  <tr key={p.id}>
                    <td>{formaterDate(p.paye_le)}</td>
                    <td>
                      {p.prenom ?? a.derniers.sansPrenom}
                      {p.utilisateur_id ? (
                        <>
                          {' '}
                          <span className={styles.mono}>{p.utilisateur_id.slice(0, 8)}</span>
                        </>
                      ) : null}
                    </td>
                    <td>{p.formule ?? ''}</td>
                    <td>{a.types[p.type]}</td>
                    <td>{a.magasins[p.magasin]}</td>
                    <td className={styles.nombre}>{formaterMontant(p.montant, p.devise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function Chiffre({ valeur, libelle }: { valeur: number; libelle: string }) {
  return (
    <div className={`carte ${styles.chiffre}`}>
      <span className={styles.chiffreValeur}>{valeur}</span>
      <span className={styles.chiffreLibelle}>{libelle}</span>
    </div>
  )
}
