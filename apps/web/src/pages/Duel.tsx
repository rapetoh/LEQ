import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'

import { AnneauMinuteur } from '../composants/AnneauMinuteur'
import { Bouton } from '../composants/Bouton'
import { Bulle } from '../composants/Bulle'
import { Sigle } from '../composants/Sigle'
import { fr } from '../fr'
import { resteAvant } from '../services/delai'
import { formaterDuree } from '../services/duree'
import { texteDelai, texteVerdict } from '../services/messages'
import {
  estStatutTentativeFinal,
  lireIssue,
  lireInvitation,
  messageRefus,
  publier,
  rejoindre,
  envoyerPrise,
  lireStatutTentative,
  type IssueDuel,
} from '../services/duel'
import {
  Enregistreur,
  ErreurMicro,
  navigateurSaitEnregistrer,
  type PriseEnregistree,
  type RaisonMicro,
} from '../services/enregistrement'

/**
 * The duel invitation, chapter 11: the link works without the application. The invitee never
 * hears the other take before recording, the verdict is said to be automatic, and the page
 * says what becomes of the voice at the moment it is sent, not only in the terms.
 */

type Invitation = { id: string; sujet: string; dureeMaxS: number; echeance: string }

type Etat =
  | { phase: 'chargement' }
  | { phase: 'invitation'; invitation: Invitation }
  | { phase: 'enregistrement'; invitation: Invitation; duelId: string }
  | {
      phase: 'prete'
      invitation: Invitation
      duelId: string
      prise: PriseEnregistree
      /** Set when a send just failed, so the screen says why and offers to send again. */
      echec?: string
    }
  | {
      phase: 'travail'
      libelle: string
      detail: string | null
      /** Kept so a failure can hand the take back instead of losing it. */
      reprise: { invitation: Invitation; duelId: string; prise: PriseEnregistree } | null
    }
  | { phase: 'attente'; duelId: string }
  | { phase: 'verdict'; issue: IssueDuel }
  | { phase: 'message'; titre: string; detail: string }

const INTERVALLE_ANALYSE_MS = 3_000
const INTERVALLE_VERDICT_MS = 20_000
const PHASES_CENTREES = new Set(['chargement', 'message', 'travail', 'attente', 'verdict'])

function dureeMinimale(dureeMaxS: number): number {
  return Math.min(20, Math.max(5, Math.floor(dureeMaxS / 4)))
}

export function Duel() {
  const { jeton = '' } = useParams()
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' })
  // Who is answering. Asked before the seat is claimed, because the seat is what tells the
  // inviter someone came.
  const [prenom, setPrenom] = useState('')
  const [email, setEmail] = useState('')
  const [erreurIdentite, setErreurIdentite] = useState<string | null>(null)
  const [secondes, setSecondes] = useState(0)
  const [avertissement, setAvertissement] = useState<string | null>(null)
  // Kept across retries: the upload and the row are both keyed by it, so sending again after a
  // failure never duplicates anything.
  const [tentative, setTentative] = useState<string | null>(null)
  const enregistreur = useRef(new Enregistreur())

  // The microphone is given back whatever happens to the page.
  useEffect(() => {
    const courant = enregistreur.current
    return () => courant.annuler()
  }, [])

  const montrerRefus = useCallback((erreur: unknown) => {
    const { titre, detail } = messageRefus(erreur)
    setEtat({ phase: 'message', titre, detail })
  }, [])

  // 1. Read the invitation. Anonymous, no account, no session yet.
  useEffect(() => {
    let vivant = true
    void (async () => {
      try {
        const reponse = await lireInvitation(jeton)
        if (!vivant) return
        if (reponse.raison === 'introuvable') {
          setEtat({
            phase: 'message',
            titre: fr.duel.introuvable,
            detail: fr.duel.introuvableDetail,
          })
          return
        }
        if (reponse.statut === 'clos') {
          setEtat({ phase: 'message', titre: fr.duel.closTitre, detail: fr.duel.closDetail })
          return
        }
        if (reponse.statut === 'expire' || resteAvant(reponse.echeance).etat === 'passe') {
          setEtat({ phase: 'message', titre: fr.duel.expireTitre, detail: fr.duel.expireDetail })
          return
        }
        if (reponse.c_est_mon_duel) {
          setEtat({ phase: 'message', titre: fr.duel.surSoiTitre, detail: fr.duel.surSoiDetail })
          return
        }
        // The seat is taken by this very person whenever they came back: a denied microphone, a
        // reload, a backgrounded tab. Coming back is resuming, and telling them someone else
        // answered would lock them out of their own duel until it expired.
        if (reponse.deja_repondu && !reponse.c_est_moi) {
          setEtat({ phase: 'message', titre: fr.duel.completTitre, detail: fr.duel.completDetail })
          return
        }
        setEtat({
          phase: 'invitation',
          invitation: {
            id: reponse.id,
            sujet: reponse.sujet,
            dureeMaxS: reponse.duree_max_s,
            echeance: reponse.echeance,
          },
        })
      } catch (erreur) {
        if (vivant) montrerRefus(erreur)
      }
    })()
    return () => {
      vivant = false
    }
  }, [jeton, montrerRefus])

  // 2. Claim the seat, then open the microphone. A refusal is said before the effort.
  const commencer = async (invitation: Invitation) => {
    if (!navigateurSaitEnregistrer()) {
      setEtat({
        phase: 'message',
        titre: fr.duel.navigateurTitre,
        detail: fr.duel.navigateurDetail,
      })
      return
    }
    const nom = prenom.trim()
    const adresse = email.trim()
    if (nom === '') {
      setErreurIdentite(fr.duel.prenomManquant)
      return
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adresse)) {
      setErreurIdentite(fr.duel.emailManquant)
      return
    }
    setErreurIdentite(null)
    setEtat({ phase: 'travail', libelle: fr.duel.preparation, detail: null, reprise: null })
    try {
      const duelId = await rejoindre(jeton, nom, adresse)
      await enregistreur.current.demarrer()
      setSecondes(0)
      setAvertissement(null)
      setEtat({ phase: 'enregistrement', invitation, duelId })
    } catch (erreur) {
      if (erreur instanceof ErreurMicro) {
        setEtat({ phase: 'message', ...messageMicro(erreur.raison) })
        return
      }
      montrerRefus(erreur)
    }
  }

  const terminer = async (automatique = false) => {
    if (etat.phase !== 'enregistrement') return
    const minimum = dureeMinimale(etat.invitation.dureeMaxS)
    if (!automatique && enregistreur.current.secondes() < minimum) {
      setAvertissement(fr.duel.tropCourte(minimum))
      return
    }
    const { invitation, duelId } = etat
    try {
      const prise = await enregistreur.current.arreter()
      setEtat({ phase: 'prete', invitation, duelId, prise })
    } catch (erreur) {
      console.warn('duel: arrêt impossible', erreur)
      setEtat({ phase: 'message', titre: fr.duel.erreur, detail: fr.commun.reessayer })
    }
  }

  // The interval must never hold a stale handler: it reads the latest one through this ref.
  const terminerRef = useRef(terminer)
  useEffect(() => {
    terminerRef.current = terminer
  })

  // The timer, and the ceiling of the duel: at the maximum the take stops by itself.
  useEffect(() => {
    if (etat.phase !== 'enregistrement') return
    const maximum = etat.invitation.dureeMaxS
    const battement = setInterval(() => {
      const ecoulees = enregistreur.current.secondes()
      setSecondes(ecoulees)
      if (ecoulees >= maximum) void terminerRef.current(true)
    }, 200)
    return () => clearInterval(battement)
  }, [etat])

  const refaire = async (invitation: Invitation, duelId: string) => {
    enregistreur.current.annuler()
    setAvertissement(null)
    try {
      await enregistreur.current.demarrer()
      setSecondes(0)
      setEtat({ phase: 'enregistrement', invitation, duelId })
    } catch (erreur) {
      if (erreur instanceof ErreurMicro)
        setEtat({ phase: 'message', ...messageMicro(erreur.raison) })
      else montrerRefus(erreur)
    }
  }

  // 3. Send: upload, wait for the analysis, publish. Then the duel closes on its own.
  const envoyer = async (
    invitation: Invitation,
    duelId: string,
    prise: PriseEnregistree,
    tentativeExistante?: string,
  ) => {
    const reprise = { invitation, duelId, prise }
    setEtat({ phase: 'travail', libelle: fr.duel.envoi, detail: null, reprise })
    // The same identifier across retries: the upload and the row are both keyed by it, so
    // sending again after a cut never duplicates anything.
    const tentativeId = tentativeExistante ?? crypto.randomUUID()
    setTentative(tentativeId)
    try {
      await envoyerPrise({ duelId, prise, tentativeId })
      setEtat({
        phase: 'travail',
        libelle: fr.duel.analyse,
        detail: fr.duel.analyseDetail,
        reprise,
      })
      const statut = await attendreAnalyse(tentativeId)
      if (statut !== 'retour_disponible') {
        setEtat({ phase: 'prete', invitation, duelId, prise, echec: fr.duel.echecAnalyse })
        return
      }
      await publier(tentativeId)
      setEtat({ phase: 'attente', duelId })
    } catch (erreur) {
      // The take is still in hand: hand it back with the reason, rather than a dead end.
      const { titre } = messageRefus(erreur)
      setEtat({ phase: 'prete', invitation, duelId, prise, echec: titre })
    }
  }

  // 4. The verdict, once both have spoken or the deadline has passed.
  useEffect(() => {
    if (etat.phase !== 'attente') return
    const duelId = etat.duelId
    let vivant = true
    const regarder = async () => {
      try {
        const issue = await lireIssue(duelId)
        if (vivant && issue.statut !== 'ouvert') setEtat({ phase: 'verdict', issue })
      } catch (erreur) {
        console.warn('duel: lecture du verdict impossible', erreur)
      }
    }
    void regarder()
    const battement = setInterval(() => void regarder(), INTERVALLE_VERDICT_MS)
    return () => {
      vivant = false
      clearInterval(battement)
    }
  }, [etat])

  const centre = PHASES_CENTREES.has(etat.phase)
  return (
    <main className={centre ? 'ecran ecran-centre' : 'ecran'}>
      {etat.phase === 'chargement' ? (
        <Centre>
          <Bulle taille={96} visage="attend" />
          <p className="corps">{fr.commun.chargement}</p>
        </Centre>
      ) : null}

      {etat.phase === 'message' ? (
        <Centre>
          <Bulle taille={96} visage="sourit" calme />
          <h1>{etat.titre}</h1>
          <p className="corps">{etat.detail}</p>
          <PiedApplication />
        </Centre>
      ) : null}

      {etat.phase === 'invitation' ? (
        <>
          <div className="entete-bulle">
            <Sigle hauteur={24} />
            <Bulle taille={96} visage="parle" />
            <p className="surtitre">{fr.duel.surtitre}</p>
          </div>
          <h1>{fr.duel.titre}</h1>
          <p className="corps">{fr.duel.intro}</p>

          <section className="carte carte-sujet">
            <p className="surtitre">{fr.duel.sujetTitre}</p>
            <p className="texte">{etat.invitation.sujet}</p>
            <p className="petit">{fr.duel.plafond(formaterDuree(etat.invitation.dureeMaxS))}</p>
          </section>

          <p className="etiquette-delai">{texteDelai(etat.invitation.echeance)}</p>

          <section className="carte identite">
            <label className="champ">
              <span className="champ-libelle">{fr.duel.prenomChamp}</span>
              <input
                className="champ-saisie"
                type="text"
                autoComplete="given-name"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
              />
              <span className="petit">{fr.duel.prenomAide}</span>
            </label>
            <label className="champ">
              <span className="champ-libelle">{fr.duel.emailChamp}</span>
              <input
                className="champ-saisie"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <span className="petit">{fr.duel.emailAide}</span>
            </label>
            {erreurIdentite ? (
              <p className="petit erreur" role="alert">
                {erreurIdentite}
              </p>
            ) : null}
          </section>

          <p className="petit">{fr.duel.automatique}</p>

          <div className="pousse actions">
            <Bouton libelle={fr.duel.commencer} onClick={() => void commencer(etat.invitation)} />
            <PiedLegal />
          </div>
        </>
      ) : null}

      {etat.phase === 'enregistrement' ? (
        <>
          <p className="surtitre">{fr.duel.sujetTitre}</p>
          <h2>{etat.invitation.sujet}</h2>
          <div className="enregistreur">
            <Bulle taille={96} visage="attend" calme />
            <AnneauMinuteur secondes={secondes} secondesMax={etat.invitation.dureeMaxS} enCours />
            <p className="corps">{fr.duel.enCours}</p>
            {avertissement ? <p className="message message-calme">{avertissement}</p> : null}
          </div>
          <div className="pousse actions">
            <Bouton libelle={fr.duel.arreter} onClick={() => void terminer()} />
            <Bouton
              libelle={fr.duel.refaire}
              variante="secondaire"
              onClick={() => void refaire(etat.invitation, etat.duelId)}
            />
          </div>
        </>
      ) : null}

      {etat.phase === 'prete' ? (
        <>
          <p className="surtitre">{fr.duel.sujetTitre}</p>
          <h2>{etat.invitation.sujet}</h2>
          <div className="enregistreur">
            <Bulle taille={96} visage="sourit" calme />
            <AnneauMinuteur
              secondes={etat.prise.dureeS}
              secondesMax={etat.invitation.dureeMaxS}
              enCours={false}
            />
            <h3>{fr.duel.prete}</h3>
            <p className="corps centre">{fr.duel.preteDetail}</p>
            {etat.echec ? <p className="message message-erreur">{etat.echec}</p> : null}
          </div>
          <div className="pousse actions">
            <p className="message message-calme">{fr.duel.conservation}</p>
            <Bouton
              libelle={etat.echec ? fr.duel.envoyerEncore : fr.duel.envoyer}
              onClick={() =>
                void envoyer(etat.invitation, etat.duelId, etat.prise, tentative ?? undefined)
              }
            />
            <Bouton
              libelle={fr.duel.refaire}
              variante="secondaire"
              onClick={() => void refaire(etat.invitation, etat.duelId)}
            />
          </div>
        </>
      ) : null}

      {etat.phase === 'travail' ? (
        <Centre>
          <Bulle taille={96} visage="parle" />
          <h2>{etat.libelle}</h2>
          {etat.detail ? <p className="corps">{etat.detail}</p> : null}
        </Centre>
      ) : null}

      {etat.phase === 'attente' ? (
        <Centre>
          <Bulle taille={96} visage="sourit" calme />
          <h1>{fr.duel.attenteTitre}</h1>
          <p className="corps">{fr.duel.attenteDetail}</p>
          <p className="petit">{fr.duel.automatique}</p>
          <PiedApplication />
        </Centre>
      ) : null}

      {etat.phase === 'verdict' ? (
        <Centre>
          <Bulle taille={96} visage={etat.issue.verdict === 'invite' ? 'parle' : 'sourit'} calme />
          <p className="surtitre">{fr.duel.verdictTitre}</p>
          <div className="verdict">
            <h1 className={etat.issue.verdict === 'invite' ? 'verdict-gagne' : undefined}>
              {texteVerdict(etat.issue)}
            </h1>
            <p className="petit">{fr.duel.verdictDetail}</p>
          </div>
          <PiedApplication />
        </Centre>
      ) : null}
    </main>
  )
}

/** The centred states share one layout: Bulle, a sentence, and what to do next. */
function Centre({ children }: { children: ReactNode }) {
  return <>{children}</>
}

/** The install invitation, only when a store link exists: never a dead link. */
function PiedApplication() {
  const lien = import.meta.env.VITE_LIEN_APPLICATION ?? ''
  return (
    <div className="pousse actions">
      <p className="petit">{fr.duel.presentation}</p>
      {lien ? (
        <a className="bouton bouton-secondaire" href={lien}>
          {fr.duel.installer}
        </a>
      ) : null}
      <PiedLegal />
    </div>
  )
}

function PiedLegal() {
  return (
    <p className="petit centre">
      <Link to="/confidentialite">{fr.legal.confidentialiteTitre}</Link>
      {' · '}
      <Link to="/conditions">{fr.legal.conditionsTitre}</Link>
    </p>
  )
}

function messageMicro(raison: RaisonMicro): { titre: string; detail: string } {
  if (raison === 'absent')
    return { titre: fr.duel.navigateurTitre, detail: fr.duel.navigateurDetail }
  return { titre: fr.duel.microTitre, detail: fr.duel.microDetail }
}

/** Polls the attempt until the worker is done with it. */
async function attendreAnalyse(tentativeId: string): Promise<string | null> {
  const limite = Date.now() + 5 * 60_000
  for (;;) {
    const statut = await lireStatutTentative(tentativeId)
    if (statut && estStatutTentativeFinal(statut)) return statut
    if (Date.now() > limite) return statut
    await new Promise((resoudre) => setTimeout(resoudre, INTERVALLE_ANALYSE_MS))
  }
}
