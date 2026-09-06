// Environment parsing. Read once at startup; every other module receives a Config value.
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { z } from 'zod'

export const PROCESSUS = ['worker', 'temps-reel'] as const
export type Processus = (typeof PROCESSUS)[number]

export const NIVEAUX_LOG = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const
export type NiveauLog = (typeof NIVEAUX_LOG)[number]

export const TRANSCRIPTEURS = ['stub'] as const
export type NomTranscripteur = (typeof TRANSCRIPTEURS)[number]

// prosodie/extraire.py sits one level above src/ and above dist/, so the same
// relative path works for `tsx src/index.ts` and for `node dist/index.js`.
const cheminScriptParDefaut = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'prosodie',
  'extraire.py',
)

const SchemaEnv = z.object({
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((v) => v.startsWith('postgres://') || v.startsWith('postgresql://'), {
      message: 'DATABASE_URL must be a postgres:// or postgresql:// URL',
    }),
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  PROCESS: z.enum(PROCESSUS),
  WORKER_ID: z.string().min(1),
  LOG_LEVEL: z.enum(NIVEAUX_LOG).default('info'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  TRANSCRIPTEUR: z.enum(TRANSCRIPTEURS).default('stub'),
  FFMPEG_PATH: z.string().min(1).default('ffmpeg'),
  PYTHON_PATH: z.string().min(1).default('python3'),
  PROSODIE_SCRIPT: z.string().min(1).default(cheminScriptParDefaut),
  INTERVALLE_INACTIF_MS: z.coerce.number().int().min(100).default(2000),
  DELAI_OUTIL_MS: z.coerce.number().int().min(1000).default(120_000),
})

export interface Config {
  databaseUrl: string
  supabaseUrl: string
  supabaseSecretKey: string
  processus: Processus
  workerId: string
  logLevel: NiveauLog
  port: number
  transcripteur: NomTranscripteur
  ffmpegPath: string
  pythonPath: string
  prosodieScript: string
  intervalleInactifMs: number
  delaiOutilMs: number
}

export class ErreurConfig extends Error {
  override name = 'ErreurConfig'
}

/**
 * Parse the environment into a typed Config. Empty strings count as unset.
 * PROCESS falls back to FLY_PROCESS_GROUP (set by Fly on every machine),
 * WORKER_ID to "<hostname>-<pid>".
 */
export function chargerConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const nettoye: Record<string, string> = {}
  for (const [cle, valeur] of Object.entries(env)) {
    if (valeur !== undefined && valeur !== '') nettoye[cle] = valeur
  }
  nettoye['PROCESS'] ??= nettoye['FLY_PROCESS_GROUP'] ?? ''
  nettoye['WORKER_ID'] ??= `${os.hostname()}-${process.pid}`

  const resultat = SchemaEnv.safeParse(nettoye)
  if (!resultat.success) {
    throw new ErreurConfig(`Invalid environment:\n${z.prettifyError(resultat.error)}`)
  }
  const e = resultat.data
  return {
    databaseUrl: e.DATABASE_URL,
    supabaseUrl: e.SUPABASE_URL,
    supabaseSecretKey: e.SUPABASE_SECRET_KEY,
    processus: e.PROCESS,
    workerId: e.WORKER_ID,
    logLevel: e.LOG_LEVEL,
    port: e.PORT,
    transcripteur: e.TRANSCRIPTEUR,
    ffmpegPath: e.FFMPEG_PATH,
    pythonPath: e.PYTHON_PATH,
    prosodieScript: e.PROSODIE_SCRIPT,
    intervalleInactifMs: e.INTERVALLE_INACTIF_MS,
    delaiOutilMs: e.DELAI_OUTIL_MS,
  }
}
