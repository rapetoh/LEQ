import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'

import { Echec, Squelette } from '../composants/Etats'
import { Icone, type NomIcone } from '../composants/Icone'
import { fr } from '../fr'
import { chargerTableau, cleRequeteTableau, type Tableau } from '../services/tableauDeBord'
import styles from './Accueil.module.css'

/**
 * The home of the space.
 *
 * It used to be a grid of cards pointing at the pages already listed in the left menu, which
 * told Rebecca nothing she could not read from the menu itself. It answers three questions now,
 * in the order she would ask them on opening it: what is waiting for me, what is the product
 * doing, and what is still missing before this can be published.
 */
export function Accueil() {
  const tableau = useQuery({ queryKey: cleRequeteTableau, queryFn: chargerTableau })

  return (
    <div className="page">
      <header className="page-entete">
        <h1>{fr.accueil.titre}</h1>
        <p>{fr.accueil.intro}</p>
      </header>

      {tableau.isPending ? (
        <Squelette lignes={5} />
      ) : tableau.isError ? (
        <Echec titre={fr.accueil.erreurChargement} detail={tableau.error.message} />
      ) : (
        <Contenu tableau={tableau.data} />
      )}
    </div>
  )
}

function Contenu({ tableau }: { tableau: Tableau }) {
  const { a_traiter, semaine, etat, a_ecrire } = tableau
  const enAttente = a_traiter.moderation + a_traiter.echanges + a_traiter.demandes_donnees
  const aEcrire =
    a_ecrire.defis +
    a_ecrire.exercices +
    a_ecrire.recompenses +
    a_ecrire.sujets_arene +
    a_ecrire.theses

  return (
    <>
      <section aria-labelledby="titre-attente" className={styles.section}>
        <h2 id="titre-attente">{fr.accueil.attente.titre}</h2>
        <p className={styles.sousTitre}>
          {enAttente === 0 ? fr.accueil.attente.rien : fr.accueil.attente.intro}
        </p>
        <div className={styles.filesAttente}>
          <File
            icone="moderation"
            vers="/moderation"
            nombre={a_traiter.moderation}
            libelle={fr.accueil.attente.moderation}
          />
          <File
            icone="echanges"
            vers="/echanges"
            nombre={a_traiter.echanges}
            libelle={fr.accueil.attente.echanges}
          />
          <File
            icone="exports"
            vers="/exports"
            nombre={a_traiter.demandes_donnees}
            libelle={fr.accueil.attente.demandes}
          />
        </div>
      </section>

      <section aria-labelledby="titre-semaine" className={styles.section}>
        <h2 id="titre-semaine">{fr.accueil.semaine.titre}</h2>
        <p className={styles.sousTitre}>{fr.accueil.semaine.intro}</p>
        <div className={styles.chiffres}>
          <Chiffre valeur={semaine.prises} libelle={fr.accueil.semaine.prises} />
          <Chiffre valeur={semaine.personnes} libelle={fr.accueil.semaine.personnes} />
          <Chiffre valeur={semaine.defis_valides} libelle={fr.accueil.semaine.defisValides} />
          <Chiffre valeur={semaine.comptes} libelle={fr.accueil.semaine.comptes} />
        </div>
      </section>

      <section aria-labelledby="titre-etat" className={styles.section}>
        <h2 id="titre-etat">{fr.accueil.etat.titre}</h2>
        <div className={`carte ${styles.etat}`}>
          <div className={styles.etatLigne}>
            <span className={styles.etatLibelle}>{fr.accueil.etat.fonctions}</span>
            <div className={styles.pastilles}>
              {(['arene', 'duels', 'face_a_face'] as const).map((cle) => (
                <span
                  key={cle}
                  className={etat.drapeaux[cle] ? styles.pastilleLigne : styles.pastilleHors}
                >
                  {fr.accueil.etat.noms[cle]}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.etatLigne}>
            <span className={styles.etatLibelle}>{fr.accueil.etat.sujet}</span>
            <span className={styles.etatValeur}>
              {etat.sujet_arene
                ? fr.accueil.etat.sujetJour(etat.sujet_arene.texte, etat.sujet_arene.jour)
                : fr.accueil.etat.sujetAucun}
            </span>
          </div>

          <div className={styles.etatLigne}>
            <span className={styles.etatLibelle}>{fr.accueil.etat.annonces}</span>
            <span className={styles.etatValeur}>
              {fr.accueil.etat.annoncesValeur(etat.annonces_ce_mois, etat.plafond_annonces)}
            </span>
          </div>

          <div className={styles.etatLigne}>
            <span className={styles.etatLibelle}>{fr.accueil.etat.grille}</span>
            <span className={etat.grille_publiee ? styles.pastilleLigne : styles.pastilleHors}>
              {etat.grille_publiee ? fr.accueil.etat.grillePubliee : fr.accueil.etat.grilleAbsente}
            </span>
          </div>
        </div>
      </section>

      <section aria-labelledby="titre-ecrire" className={styles.section}>
        <h2 id="titre-ecrire">{fr.accueil.ecrire.titre}</h2>
        <p className={styles.sousTitre}>
          {aEcrire === 0 ? fr.accueil.ecrire.rien : fr.accueil.ecrire.intro}
        </p>
        <div className={styles.filesAttente}>
          <File
            icone="defis"
            vers="/defis"
            nombre={a_ecrire.defis}
            libelle={fr.accueil.ecrire.defis}
            calme
          />
          <File
            icone="exercices"
            vers="/exercices"
            nombre={a_ecrire.exercices}
            libelle={fr.accueil.ecrire.exercices}
            calme
          />
          <File
            icone="recompenses"
            vers="/recompenses"
            nombre={a_ecrire.recompenses}
            libelle={fr.accueil.ecrire.recompenses}
            calme
          />
          <File
            icone="sujets"
            vers="/sujets"
            nombre={a_ecrire.sujets_arene}
            libelle={fr.accueil.ecrire.sujets}
            calme
          />
          <File
            icone="theses"
            vers="/theses"
            nombre={a_ecrire.theses}
            libelle={fr.accueil.ecrire.theses}
            calme
          />
        </div>
      </section>
    </>
  )
}

/** A queue: how many, of what, and the way to it. Zero is a good state and looks like one. */
function File({
  icone,
  vers,
  nombre,
  libelle,
  calme = false,
}: {
  icone: NomIcone
  vers: string
  nombre: number
  libelle: string
  calme?: boolean
}) {
  const vide = nombre === 0
  return (
    <Link to={vers} className={`carte ${styles.file} ${vide ? styles.fileVide : ''}`}>
      <span className={calme || vide ? styles.fileMarqueCalme : styles.fileMarque}>
        <Icone nom={icone} taille={17} />
      </span>
      <span className={styles.fileNombre}>{nombre}</span>
      <span className={styles.fileLibelle}>{libelle}</span>
    </Link>
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
