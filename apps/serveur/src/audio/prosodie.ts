// ExtracteurProsodie backed by Praat (parselmouth) through prosodie/extraire.py.
// PCM goes to a temporary raw f32le file, the CLI writes JSON on stdout.
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import type { ExtracteurProsodie, PisteProsodie } from '../contrat.js'

export class ErreurProsodie extends Error {
  override name = 'ErreurProsodie'
}

const SchemaPiste = z.object({
  pas_s: z.number().positive(),
  f0_hz: z.array(z.number().nullable()),
  intensite_db: z.array(z.number().nullable()),
})

export interface OptionsProsodie {
  pythonPath?: string
  scriptPath: string
  delaiMs?: number
  dossierTemporaire?: string
}

/** CLI arguments for extraire.py on a raw f32le file. */
export function construireArgumentsProsodie(
  scriptPath: string,
  cheminEntree: string,
  frequenceHz: number,
): string[] {
  return [
    scriptPath,
    '--entree',
    cheminEntree,
    '--format',
    'f32le',
    '--frequence',
    String(frequenceHz),
  ]
}

export class ExtracteurProsodiePraat implements ExtracteurProsodie {
  private readonly pythonPath: string
  private readonly scriptPath: string
  private readonly delaiMs: number
  private readonly dossierTemporaire: string

  constructor(options: OptionsProsodie) {
    this.pythonPath = options.pythonPath ?? 'python3'
    this.scriptPath = options.scriptPath
    this.delaiMs = options.delaiMs ?? 120_000
    this.dossierTemporaire = options.dossierTemporaire ?? os.tmpdir()
  }

  async extraire(pcm: Float32Array, frequenceHz: number): Promise<PisteProsodie> {
    if (pcm.length === 0) throw new ErreurProsodie('Empty PCM')
    const dossier = await mkdtemp(path.join(this.dossierTemporaire, 'leq-prosodie-'))
    const cheminEntree = path.join(dossier, 'entree.f32le')
    try {
      await writeFile(cheminEntree, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength))
      const stdout = await this.executer(
        construireArgumentsProsodie(this.scriptPath, cheminEntree, frequenceHz),
      )
      let json: unknown
      try {
        json = JSON.parse(stdout)
      } catch {
        throw new ErreurProsodie(`extraire.py did not return JSON: ${stdout.slice(0, 200)}`)
      }
      const resultat = SchemaPiste.safeParse(json)
      if (!resultat.success) {
        throw new ErreurProsodie(
          `extraire.py returned an unexpected shape: ${z.prettifyError(resultat.error)}`,
        )
      }
      if (resultat.data.f0_hz.length !== resultat.data.intensite_db.length) {
        throw new ErreurProsodie('extraire.py returned tracks of different lengths')
      }
      return resultat.data
    } finally {
      await rm(dossier, { recursive: true, force: true })
    }
  }

  private executer(args: string[]): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let stdout = ''
      let stderr = ''
      let regle = false
      const enfant = spawn(this.pythonPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
      })
      const minuteur = setTimeout(() => {
        if (regle) return
        regle = true
        enfant.kill('SIGKILL')
        reject(new ErreurProsodie(`extraire.py exceeded ${this.delaiMs} ms and was killed`))
      }, this.delaiMs)

      enfant.stdout.setEncoding('utf8')
      enfant.stdout.on('data', (texte: string) => (stdout += texte))
      enfant.stderr.setEncoding('utf8')
      enfant.stderr.on('data', (texte: string) => {
        if (stderr.length < 4000) stderr += texte
      })
      enfant.on('error', (erreur: NodeJS.ErrnoException) => {
        if (regle) return
        regle = true
        clearTimeout(minuteur)
        reject(
          new ErreurProsodie(
            erreur.code === 'ENOENT'
              ? `python not found at "${this.pythonPath}" (set PYTHON_PATH)`
              : `extraire.py could not start: ${erreur.message}`,
          ),
        )
      })
      enfant.on('close', (code, signal) => {
        if (regle) return
        regle = true
        clearTimeout(minuteur)
        if (code === 0) resolve(stdout)
        else
          reject(
            new ErreurProsodie(
              `extraire.py failed (exit ${code ?? 'null'}${signal ? `, signal ${signal}` : ''}): ${stderr.trim() || 'no stderr'}`,
            ),
          )
      })
    })
  }
}
