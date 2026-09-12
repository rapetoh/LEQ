// HTTP surface. Both processes answer GET /sante. Only temps-reel is reachable from the
// internet, so it carries the two public things: the WebSocket /debat, which runs one
// face-à-face per connection (Phase 8), and the static pages of apps/web, whose duel invitation
// must work without the application.
import {
  serve,
  upgradeWebSocket,
  type ServerType,
  type WebSocketServerLike,
} from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { WebSocketServer } from 'ws'
import type { Config, Processus } from './config.js'
import type { Canal, Conduite } from './debat/index.js'
import type { Logger } from './log.js'

/** Routes of apps/web that the browser may open directly: each one is answered with the page. */
export const CHEMINS_WEB = ['/duel/:jeton', '/confidentialite', '/conditions'] as const

export const MESSAGE_DEBAT_INDISPONIBLE = {
  type: 'indisponible',
  message: 'Le face-à-face arrive plus tard.',
} as const

/** What /debat needs to run a session. Absent on a worker, and on a server without a database. */
export interface DependancesDebat {
  creerConduite(canal: Canal): Conduite
}

export function creerApplication(
  processus: Processus,
  dossierWeb?: string,
  debat?: DependancesDebat,
  dossierAdmin?: string,
): Hono {
  const app = new Hono()

  app.get('/sante', (c) => c.json({ ok: true, processus }))

  // Rebecca's space, under /admin on the same host. Everything it shows is behind a sign-in and
  // the admin role in row-level security, so serving the bundle publicly gives nothing away.
  // It comes before the public pages so that /admin is never swallowed by their fallback.
  if (processus === 'temps-reel' && dossierAdmin) {
    app.use(
      '/admin/*',
      serveStatic({ root: dossierAdmin, rewriteRequestPath: (c) => c.replace(/^\/admin/, '') }),
    )
    // Anything the bundle does not hold is a route of the space: same document, as a
    // single-page application needs.
    app.get('/admin', serveStatic({ path: `${dossierAdmin}/index.html` }))
    app.get('/admin/*', serveStatic({ path: `${dossierAdmin}/index.html` }))
  }

  if (processus === 'temps-reel' && dossierWeb) {
    // Whatever the build produced, served as it is. Listing the paths by hand is how the brand
    // mark ended up 404ing: a bundle grows files, and the list does not follow.
    // `serveStatic` calls the next handler when the file is not there, so /sante and /debat
    // are untouched.
    app.use('/*', serveStatic({ root: dossierWeb }))
    for (const chemin of CHEMINS_WEB) {
      app.get(chemin, serveStatic({ path: `${dossierWeb}/index.html` }))
    }
  }

  if (processus === 'temps-reel') {
    app.get(
      '/debat',
      upgradeWebSocket(() => {
        // Without the providers wired in (a worker, or a server with no database), the socket
        // says so plainly instead of hanging.
        if (!debat) {
          return {
            onOpen(_evenement, ws) {
              ws.send(JSON.stringify(MESSAGE_DEBAT_INDISPONIBLE))
              ws.close(1000, 'indisponible')
            },
          }
        }
        let conduite: Conduite | null = null
        return {
          onOpen(_evenement, ws) {
            conduite = debat.creerConduite({
              envoyer: (message) => ws.send(JSON.stringify(message)),
              fermer: () => ws.close(1000, 'fin'),
            })
          },
          onMessage(evenement) {
            const donnees = evenement.data
            if (typeof donnees !== 'string') return
            void conduite?.recevoir(donnees)
          },
          onClose() {
            // The session decides whether this was our cut; it always is, unless it had
            // already ended on its own. The promise is registered so a shutdown can wait for it.
            const fermeture = conduite?.surFermeture()
            if (fermeture) {
              fermeturesEnCours.add(fermeture)
              void fermeture.finally(() => fermeturesEnCours.delete(fermeture))
            }
            conduite = null
          },
        }
      }),
    )
  }

  app.notFound((c) => c.json({ ok: false, erreur: 'introuvable' }, 404))
  app.onError((erreur, c) => {
    console.error(erreur)
    return c.json({ ok: false, erreur: 'erreur_serveur' }, 500)
  })

  return app
}

export interface ServeurHttp {
  fermer(): Promise<void>
}

/** Closing writes still in flight when the process was asked to stop. */
const fermeturesEnCours = new Set<Promise<void>>()

/**
 * Waits for every debate that was being closed to finish writing. A deploy used to terminate the
 * sockets and tear the pool down in the same breath, so those writes threw into a swallowed
 * catch and the sessions stayed open: the people mid-debate were then blocked for half an hour
 * and finally charged a slot for our own deploy.
 */
export async function attendreFermeturesDebats(): Promise<void> {
  await Promise.allSettled([...fermeturesEnCours])
}

export function demarrerHttp(
  config: Pick<Config, 'port' | 'processus' | 'dossierWeb' | 'dossierAdmin'>,
  log: Logger,
  debat?: DependancesDebat,
): ServeurHttp {
  const app = creerApplication(config.processus, config.dossierWeb, debat, config.dossierAdmin)
  const wss = new WebSocketServer({ noServer: true })
  // ws types `options.noServer` as `boolean | undefined`; Hono wants `noServer?: boolean`. Same
  // runtime shape, so the cast only bridges exactOptionalPropertyTypes.
  const serveurWs = wss as unknown as WebSocketServerLike
  const serveur: ServerType = serve(
    { fetch: app.fetch, port: config.port, hostname: '0.0.0.0', websocket: { server: serveurWs } },
    (info) => log.info({ port: info.port, processus: config.processus }, 'http demarre'),
  )
  return {
    fermer: () =>
      new Promise<void>((resolve) => {
        for (const client of wss.clients) client.terminate()
        wss.close()
        serveur.close(() => resolve())
      }),
  }
}
