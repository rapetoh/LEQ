// Decodes any container the phone or the browser may send (m4a/AAC, mp4, webm/opus,
// wav) to 16 kHz mono Float32 PCM by spawning ffmpeg. The input goes through a
// temporary file, not a pipe: mp4/m4a with the moov atom at the end cannot be
// demuxed from a non-seekable stream.
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export const FREQUENCE_PCM_HZ = 16_000

export class ErreurDecodage extends Error {
  override name = 'ErreurDecodage'
}

export interface OptionsDecodage {
  ffmpegPath?: string
  frequenceHz?: number
  delaiMs?: number
  /** Directory for the temporary input file. Defaults to os.tmpdir(). */
  dossierTemporaire?: string
}

export interface AudioDecode {
  pcm: Float32Array
  frequenceHz: number
  dureeS: number
}

/** ffmpeg arguments: input file to raw little-endian float32, mono, resampled. */
export function construireArgumentsFfmpeg(
  cheminEntree: string,
  frequenceHz = FREQUENCE_PCM_HZ,
): string[] {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-nostdin',
    '-i',
    cheminEntree,
    '-vn',
    '-sn',
    '-dn',
    '-map_metadata',
    '-1',
    '-ac',
    '1',
    '-ar',
    String(frequenceHz),
    '-acodec',
    'pcm_f32le',
    '-f',
    'f32le',
    'pipe:1',
  ]
}

/** Copies raw f32le bytes into an aligned Float32Array. */
export function octetsVersPcm(octets: Buffer): Float32Array {
  if (octets.length % 4 !== 0) {
    throw new ErreurDecodage(`ffmpeg output length ${octets.length} is not a multiple of 4 bytes`)
  }
  const copie = new ArrayBuffer(octets.length)
  new Uint8Array(copie).set(octets)
  return new Float32Array(copie)
}

export type Decodeur = (octets: Uint8Array) => Promise<AudioDecode>

export function creerDecodeur(options: OptionsDecodage = {}): Decodeur {
  return (octets) => decoderAudio(octets, options)
}

export async function decoderAudio(
  octets: Uint8Array,
  options: OptionsDecodage = {},
): Promise<AudioDecode> {
  const ffmpegPath = options.ffmpegPath ?? 'ffmpeg'
  const frequenceHz = options.frequenceHz ?? FREQUENCE_PCM_HZ
  const delaiMs = options.delaiMs ?? 60_000

  if (octets.length === 0) throw new ErreurDecodage('Empty audio input')

  const dossier = await mkdtemp(path.join(options.dossierTemporaire ?? os.tmpdir(), 'leq-decode-'))
  const cheminEntree = path.join(dossier, 'entree')
  try {
    await writeFile(cheminEntree, octets)
    const sortie = await executerFfmpeg(
      ffmpegPath,
      construireArgumentsFfmpeg(cheminEntree, frequenceHz),
      delaiMs,
    )
    const pcm = octetsVersPcm(sortie)
    if (pcm.length === 0) throw new ErreurDecodage('ffmpeg produced no samples (no audio stream?)')
    return { pcm, frequenceHz, dureeS: pcm.length / frequenceHz }
  } finally {
    await rm(dossier, { recursive: true, force: true })
  }
}

function executerFfmpeg(ffmpegPath: string, args: string[], delaiMs: number): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const morceaux: Buffer[] = []
    let stderr = ''
    let regle = false
    const enfant = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })

    const minuteur = setTimeout(() => {
      if (regle) return
      regle = true
      enfant.kill('SIGKILL')
      reject(new ErreurDecodage(`ffmpeg exceeded ${delaiMs} ms and was killed`))
    }, delaiMs)

    enfant.stdout.on('data', (morceau: Buffer) => morceaux.push(morceau))
    enfant.stderr.setEncoding('utf8')
    enfant.stderr.on('data', (texte: string) => {
      if (stderr.length < 4000) stderr += texte
    })
    enfant.on('error', (erreur: NodeJS.ErrnoException) => {
      if (regle) return
      regle = true
      clearTimeout(minuteur)
      reject(
        new ErreurDecodage(
          erreur.code === 'ENOENT'
            ? `ffmpeg not found at "${ffmpegPath}" (set FFMPEG_PATH)`
            : `ffmpeg could not start: ${erreur.message}`,
        ),
      )
    })
    enfant.on('close', (code, signal) => {
      if (regle) return
      regle = true
      clearTimeout(minuteur)
      if (code === 0) {
        resolve(Buffer.concat(morceaux))
      } else {
        reject(
          new ErreurDecodage(
            `ffmpeg failed (exit ${code ?? 'null'}${signal ? `, signal ${signal}` : ''}): ${stderr.trim() || 'no stderr'}`,
          ),
        )
      }
    })
  })
}
