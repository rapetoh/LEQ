/**
 * Minimal RIFF/WAVE codec: PCM 16-bit, 24-bit, 32-bit integer and 32-bit float,
 * any channel count (downmixed to mono). Enough for fixtures, the bench corpus and
 * the WAV that ffmpeg produces on the server. Pure functions over bytes.
 */
import type { Pcm } from './types.js'

export interface EnteteWav {
  frequence_hz: number
  canaux: number
  bits: number
  format: 'pcm' | 'float'
  duree_s: number
}

function lireChaine(vue: DataView, position: number, longueur: number): string {
  let s = ''
  for (let i = 0; i < longueur; i++) s += String.fromCharCode(vue.getUint8(position + i))
  return s
}

interface Segments {
  entete: EnteteWav
  dataOffset: number
  dataLength: number
}

function analyserSegments(octets: Uint8Array): Segments {
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength)
  if (
    octets.byteLength < 12 ||
    lireChaine(vue, 0, 4) !== 'RIFF' ||
    lireChaine(vue, 8, 4) !== 'WAVE'
  ) {
    throw new Error('Fichier WAV invalide : en-tête RIFF/WAVE absent')
  }
  let position = 12
  let format: EnteteWav | null = null
  let dataOffset = -1
  let dataLength = 0
  while (position + 8 <= octets.byteLength) {
    const id = lireChaine(vue, position, 4)
    const taille = vue.getUint32(position + 4, true)
    const corps = position + 8
    if (id === 'fmt ') {
      const code = vue.getUint16(corps, true)
      const canaux = vue.getUint16(corps + 2, true)
      const frequence_hz = vue.getUint32(corps + 4, true)
      const bits = vue.getUint16(corps + 14, true)
      // 0xFFFE is WAVE_FORMAT_EXTENSIBLE: the sub-format GUID starts with the real code.
      const codeReel = code === 0xfffe ? vue.getUint16(corps + 24, true) : code
      if (codeReel !== 1 && codeReel !== 3) {
        throw new Error(`Fichier WAV non pris en charge : format ${codeReel}`)
      }
      format = { frequence_hz, canaux, bits, format: codeReel === 3 ? 'float' : 'pcm', duree_s: 0 }
    } else if (id === 'data') {
      dataOffset = corps
      dataLength = Math.min(taille, octets.byteLength - corps)
    }
    position = corps + taille + (taille % 2)
  }
  if (format === null) throw new Error('Fichier WAV invalide : segment fmt absent')
  if (dataOffset < 0) throw new Error('Fichier WAV invalide : segment data absent')
  const octetsParTrame = (format.bits / 8) * format.canaux
  format.duree_s = dataLength / octetsParTrame / format.frequence_hz
  return { entete: format, dataOffset, dataLength }
}

/** Reads the header only (cheap), for durations and sanity checks. */
export function lireEnteteWav(octets: Uint8Array): EnteteWav {
  return analyserSegments(octets).entete
}

/** Decodes a WAV file into mono float PCM. Multi-channel input is averaged. */
export function decoderWav(octets: Uint8Array): Pcm {
  const { entete, dataOffset, dataLength } = analyserSegments(octets)
  const vue = new DataView(octets.buffer, octets.byteOffset + dataOffset, dataLength)
  const octetsParEchantillon = entete.bits / 8
  const trames = Math.floor(dataLength / (octetsParEchantillon * entete.canaux))
  const sortie = new Float32Array(trames)
  for (let t = 0; t < trames; t++) {
    let somme = 0
    for (let c = 0; c < entete.canaux; c++) {
      const p = (t * entete.canaux + c) * octetsParEchantillon
      let v: number
      if (entete.format === 'float') v = vue.getFloat32(p, true)
      else if (entete.bits === 16) v = vue.getInt16(p, true) / 32768
      else if (entete.bits === 24) {
        const brut = vue.getUint8(p) | (vue.getUint8(p + 1) << 8) | (vue.getInt8(p + 2) << 16)
        v = brut / 8388608
      } else if (entete.bits === 32) v = vue.getInt32(p, true) / 2147483648
      else if (entete.bits === 8) v = (vue.getUint8(p) - 128) / 128
      else throw new Error(`Fichier WAV non pris en charge : ${entete.bits} bits`)
      somme += v
    }
    sortie[t] = somme / entete.canaux
  }
  return { echantillons: sortie, frequence_hz: entete.frequence_hz }
}

/** Encodes mono PCM as 16-bit WAV bytes. */
export function encoderWav(pcm: Pcm): Uint8Array {
  const n = pcm.echantillons.length
  const tampon = new ArrayBuffer(44 + n * 2)
  const vue = new DataView(tampon)
  const ecrire = (position: number, texte: string) => {
    for (let i = 0; i < texte.length; i++) vue.setUint8(position + i, texte.charCodeAt(i))
  }
  ecrire(0, 'RIFF')
  vue.setUint32(4, 36 + n * 2, true)
  ecrire(8, 'WAVE')
  ecrire(12, 'fmt ')
  vue.setUint32(16, 16, true)
  vue.setUint16(20, 1, true)
  vue.setUint16(22, 1, true)
  vue.setUint32(24, pcm.frequence_hz, true)
  vue.setUint32(28, pcm.frequence_hz * 2, true)
  vue.setUint16(32, 2, true)
  vue.setUint16(34, 16, true)
  ecrire(36, 'data')
  vue.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, pcm.echantillons[i] as number))
    vue.setInt16(44 + i * 2, Math.round(v < 0 ? v * 32768 : v * 32767), true)
  }
  return new Uint8Array(tampon)
}
