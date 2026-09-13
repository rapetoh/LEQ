// Speech to text for a recorded take, through Whisper.
//
// `whisper-1` rather than the newer transcription models, and for one reason: it is the one that
// answers with a start and an end for every word. The engine measures the rate from those, finds
// the silences between them, and counts the filler words on them. A transcript without word
// times is a transcript the measures cannot use.
import type { Transcription } from '../contrat.js'
import type { EntreeTranscription, Transcripteur } from '../transcription/transcripteur.js'
import { appeler, type ConfigOpenAI } from './client.js'

interface ReponseVerbose {
  text?: string
  words?: Array<{ word: string; start: number; end: number }>
}

export class TranscripteurOpenAI implements Transcripteur {
  readonly nom = 'openai:whisper-1'

  constructor(private readonly config: ConfigOpenAI) {}

  async transcrire(entree: EntreeTranscription): Promise<Transcription> {
    const corps = new FormData()
    corps.append('model', 'whisper-1')
    corps.append('language', entree.langue)
    corps.append('response_format', 'verbose_json')
    corps.append('timestamp_granularities[]', 'word')
    corps.append(
      'file',
      new Blob([Buffer.from(entree.octets)], { type: entree.typeMime }),
      nomFichier(entree.typeMime),
    )
    const reponse = await appeler(this.config, '/v1/audio/transcriptions', {
      method: 'POST',
      body: corps,
      delaiMs: 120_000,
    })
    const lu = (await reponse.json()) as ReponseVerbose
    const mots = (lu.words ?? [])
      .filter((m) => m.word.trim() !== '')
      .map((m) => ({
        mot: m.word.trim(),
        debut_s: Math.max(0, m.start),
        fin_s: Math.max(m.start, m.end),
        // Whisper gives no per-word confidence over this endpoint. A flat value is honest about
        // that; a number invented to look precise would not be.
        confiance: 0.9,
      }))
    return { texte: (lu.text ?? '').trim(), mots }
  }
}

/** Whisper reads the extension to pick a decoder, so the name has to say what the bytes are. */
function nomFichier(typeMime: string): string {
  switch (typeMime) {
    case 'audio/mp4':
      return 'prise.m4a'
    case 'audio/webm':
      return 'prise.webm'
    case 'audio/ogg':
      return 'prise.ogg'
    case 'audio/wav':
      return 'prise.wav'
    case 'audio/mpeg':
      return 'prise.mp3'
    default:
      return 'prise.m4a'
  }
}
