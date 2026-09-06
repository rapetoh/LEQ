// HTTP surface. Both processes answer GET /sante. Only temps-reel exposes the
// WebSocket /debat, which for now tells the client the feature is not there yet
// (Phase 8 replaces the handler with the debate loop).
import {
  serve,
  upgradeWebSocket,
  type ServerType,
  type WebSocketServerLike,
} from '@hono/node-server'
import { Hono } from 'hono'
import { WebSocketServer } from 'ws'
import type { Config, Processus } from './config.js'
import type { Logger } from './log.js'

export const MESSAGE_DEBAT_INDISPONIBLE = {
  type: 'indisponible',
  message: 'Le face-à-face arrive plus tard.',
} as const

export function creerApplication(processus: Processus): Hono {
  const app = new Hono()

  app.get('/sante', (c) => c.json({ ok: true, processus }))

  if (processus === 'temps-reel') {
    app.get(
      '/debat',
      upgradeWebSocket(() => ({
        onOpen(_evenement, ws) {
          ws.send(JSON.stringify(MESSAGE_DEBAT_INDISPONIBLE))
          ws.close(1000, 'indisponible')
        },
      })),
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

export function demarrerHttp(config: Pick<Config, 'port' | 'processus'>, log: Logger): ServeurHttp {
  const app = creerApplication(config.processus)
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
