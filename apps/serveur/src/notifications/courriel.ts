// The one e-mail the server sends on its own: to a person who answered a duel by the link, has
// no app to push to, and gave their address for exactly this. Through the same Gmail account as
// the sign-in codes. Never throws: a mail that fails must not fail the job that produced it.
import nodemailer from 'nodemailer'
import type { Config } from '../config.js'
import type { Logger } from '../log.js'

export interface Courriel {
  a: string
  sujet: string
  texte: string
}

export type EnvoyeurCourriel = (courriel: Courriel) => Promise<void>

/** An SMTP sender from the configuration, or null when no server is configured. */
export function creerEnvoyeurCourriel(config: Config): EnvoyeurCourriel | null {
  const c = config.courriel
  if (!c) return null
  const transport = nodemailer.createTransport({
    host: c.hote,
    port: c.port,
    secure: c.port === 465,
    auth: { user: c.utilisateur, pass: c.motDePasse },
  })
  return async (courriel) => {
    await transport.sendMail({
      from: `LEQ <${c.expediteur}>`,
      to: courriel.a,
      subject: courriel.sujet,
      text: courriel.texte,
    })
  }
}

/** Sends, and says in the log what happened; the caller carries on either way. */
export async function envoyerCourriel(
  envoyeur: EnvoyeurCourriel | null,
  courriel: Courriel,
  journal: Logger,
): Promise<boolean> {
  if (!envoyeur) {
    journal.warn({ a: courriel.a }, 'courriel non envoye: aucun serveur SMTP configure')
    return false
  }
  try {
    await envoyeur(courriel)
    journal.info({ a: courriel.a }, 'courriel envoye')
    return true
  } catch (erreur) {
    journal.error({ err: erreur, a: courriel.a }, 'courriel: envoi impossible')
    return false
  }
}
