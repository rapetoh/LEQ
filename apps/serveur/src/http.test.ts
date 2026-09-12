import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { creerApplication } from './http.js'

// The public pages of apps/web are served by the internet-facing process, and only by it: a
// duel invitation has to open in a browser that never installed the application.

const PAGE = '<!doctype html><title>LEQ</title>'
let dossier: string
let relatif: string
let dossierAdmin: string
let relatifAdmin: string

beforeAll(async () => {
  dossier = await mkdtemp(path.join(os.tmpdir(), 'leq-web-'))
  await writeFile(path.join(dossier, 'index.html'), PAGE)
  await writeFile(path.join(dossier, 'favicon.svg'), '<svg/>')
  await mkdir(path.join(dossier, 'assets'))
  await writeFile(path.join(dossier, 'assets', 'index.css'), 'body{}')
  // serveStatic resolves against the working directory, the way the image does.
  relatif = path.relative(process.cwd(), dossier)

  dossierAdmin = await mkdtemp(path.join(os.tmpdir(), 'leq-admin-'))
  await writeFile(path.join(dossierAdmin, 'index.html'), '<!doctype html><title>Espace</title>')
  await writeFile(path.join(dossierAdmin, 'favicon.svg'), '<svg/>')
  await mkdir(path.join(dossierAdmin, 'assets'))
  await writeFile(path.join(dossierAdmin, 'assets', 'index.js'), 'export {}')
  relatifAdmin = path.relative(process.cwd(), dossierAdmin)
})

afterAll(async () => {
  await rm(dossier, { recursive: true, force: true })
  await rm(dossierAdmin, { recursive: true, force: true })
})

describe("Rebecca's space", () => {
  const espace = () => creerApplication('temps-reel', relatif, undefined, relatifAdmin)

  it('answers /admin and every route under it with the page', async () => {
    for (const chemin of ['/admin', '/admin/theses', '/admin/defis/nouveau']) {
      const reponse = await espace().request(chemin)
      expect(reponse.status).toBe(200)
      await expect(reponse.text()).resolves.toContain('<title>Espace</title>')
    }
  })

  it('serves its bundle from under the same prefix, which is what the build writes', async () => {
    expect((await espace().request('/admin/assets/index.js')).status).toBe(200)
    expect((await espace().request('/admin/favicon.svg')).status).toBe(200)
  })

  it('does not shadow the public pages', async () => {
    expect((await espace().request('/duel/abc')).status).toBe(200)
    expect((await espace().request('/sante')).status).toBe(200)
  })

  it('serves nothing when no space was built into the image', async () => {
    const app = creerApplication('temps-reel', relatif)
    expect((await app.request('/admin')).status).toBe(404)
  })

  it('never serves it from the worker', async () => {
    const app = creerApplication('worker', relatif, undefined, relatifAdmin)
    expect((await app.request('/admin')).status).toBe(404)
  })
})

describe('the health route', () => {
  it('answers on both processes, saying which one it is', async () => {
    for (const processus of ['worker', 'temps-reel'] as const) {
      const reponse = await creerApplication(processus).request('/sante')
      expect(reponse.status).toBe(200)
      await expect(reponse.json()).resolves.toEqual({ ok: true, processus })
    }
  })
})

describe('the debate socket', () => {
  it('is offered only by the process the internet can reach', async () => {
    const ouvrier = await creerApplication('worker').request('/debat', {
      headers: { Upgrade: 'websocket' },
    })
    expect(ouvrier.status).toBe(404)
  })
})

describe('the public pages', () => {
  it('answers the duel invitation with the page itself, whatever the token', async () => {
    const app = creerApplication('temps-reel', relatif)
    const reponse = await app.request('/duel/8f3a2b1c')
    expect(reponse.status).toBe(200)
    await expect(reponse.text()).resolves.toContain('<title>LEQ</title>')
  })

  it('answers the legal pages the stores ask for', async () => {
    const app = creerApplication('temps-reel', relatif)
    for (const chemin of ['/confidentialite', '/conditions']) {
      expect((await app.request(chemin)).status).toBe(200)
    }
  })

  it('serves the bundle and the icon', async () => {
    const app = creerApplication('temps-reel', relatif)
    expect((await app.request('/assets/index.css')).status).toBe(200)
    expect((await app.request('/favicon.svg')).status).toBe(200)
  })

  it('serves nothing when no bundle was built into the image', async () => {
    const app = creerApplication('temps-reel')
    expect((await app.request('/duel/8f3a2b1c')).status).toBe(404)
  })

  it('never serves them from the worker, which is not reachable from the internet', async () => {
    const app = creerApplication('worker', relatif)
    expect((await app.request('/duel/8f3a2b1c')).status).toBe(404)
    expect((await app.request('/confidentialite')).status).toBe(404)
  })
})
