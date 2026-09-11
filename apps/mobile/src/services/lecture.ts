// Listening to a public take (C6, C7): a signed URL from the private bucket, then playback
// through the same audio library that records. Storage decides who may read (migration 0012).
import { BUCKET_AUDIO_PUBLIC } from '@leq/domaine'
import { AudioContext, decodeAudioData, type AudioBufferSourceNode } from 'react-native-audio-api'

import { supabase } from './supabase'

const DUREE_SIGNATURE_S = 60 * 60

export async function urlSignee(chemin: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_AUDIO_PUBLIC)
    .createSignedUrl(chemin, DUREE_SIGNATURE_S)
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? 'URL indisponible')
  }
  return data.signedUrl
}

/** One take at a time: starting a second one stops the first. */
export class Lecteur {
  private contexte: AudioContext | null = null
  private source: AudioBufferSourceNode | null = null
  private surFin: (() => void) | null = null

  async jouer(url: string, surFin?: () => void): Promise<void> {
    this.arreter()
    const contexte = this.contexte ?? new AudioContext()
    this.contexte = contexte
    const mémoire = await decodeAudioData(url)
    const source = contexte.createBufferSource()
    source.buffer = mémoire
    source.connect(contexte.destination)
    this.surFin = surFin ?? null
    source.onEnded = () => {
      this.source = null
      this.surFin?.()
    }
    source.start(contexte.currentTime)
    this.source = source
  }

  arreter(): void {
    try {
      this.source?.stop()
    } catch {
      // Already stopped: nothing to do.
    }
    this.source = null
  }

  estEnLecture(): boolean {
    return this.source !== null
  }
}

export const lecteur = new Lecteur()
