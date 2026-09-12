/**
 * The conversions on the debate's audio path (ADR-007, path b). Pure on purpose: they run on
 * every 100 ms frame, an endianness or sign mistake here is inaudible until the transcription
 * comes back as nonsense, and none of that can be tested through a native module.
 */

/** What the streaming transcribers want, and what the server forwards unchanged. */
export const FREQUENCE_DEBAT_HZ = 16000
/** 100 ms per frame: the library's own buffer size, and small enough to feel live. */
export const TRAME_DEBAT = 1600
/** The voice comes back at this rate unless the provider says otherwise. */
export const FREQUENCE_VOIX_HZ = 24000

/** Float32 in [-1, 1] to Int16 little-endian, the shape every transcriber accepts. */
export function versInt16(echantillons: Float32Array): Uint8Array {
  const octets = new Uint8Array(echantillons.length * 2)
  const vue = new DataView(octets.buffer)
  for (let i = 0; i < echantillons.length; i += 1) {
    const valeur = Math.max(-1, Math.min(1, echantillons[i] ?? 0))
    vue.setInt16(i * 2, Math.round(valeur * 32767), true)
  }
  return octets
}

/**
 * Int16 little-endian back to Float32, for the voice coming down. The array is built on its own
 * ArrayBuffer, which is what the audio library's `copyToChannel` requires.
 */
export function depuisInt16(octets: Uint8Array): Float32Array<ArrayBuffer> {
  const nombre = Math.floor(octets.length / 2)
  const vue = new DataView(octets.buffer, octets.byteOffset, nombre * 2)
  const echantillons = new Float32Array(new ArrayBuffer(nombre * 4))
  for (let i = 0; i < nombre; i += 1) echantillons[i] = vue.getInt16(i * 2, true) / 32768
  return echantillons
}

const TABLE_BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Base64 without Buffer, which React Native does not have. */
export function enBase64(octets: Uint8Array): string {
  let sortie = ''
  for (let i = 0; i < octets.length; i += 3) {
    const a = octets[i] ?? 0
    const b = octets[i + 1] ?? 0
    const c = octets[i + 2] ?? 0
    const bloc = (a << 16) | (b << 8) | c
    sortie += TABLE_BASE64[(bloc >> 18) & 63]
    sortie += TABLE_BASE64[(bloc >> 12) & 63]
    sortie += i + 1 < octets.length ? TABLE_BASE64[(bloc >> 6) & 63] : '='
    sortie += i + 2 < octets.length ? TABLE_BASE64[bloc & 63] : '='
  }
  return sortie
}

export function depuisBase64(texte: string): Uint8Array {
  const propre = texte.replace(/[^A-Za-z0-9+/]/g, '')
  const longueur = Math.floor((propre.length * 3) / 4)
  const octets = new Uint8Array(longueur)
  let position = 0
  for (let i = 0; i < propre.length; i += 4) {
    const bloc =
      (TABLE_BASE64.indexOf(propre[i] ?? 'A') << 18) |
      (TABLE_BASE64.indexOf(propre[i + 1] ?? 'A') << 12) |
      (TABLE_BASE64.indexOf(propre[i + 2] ?? 'A') << 6) |
      TABLE_BASE64.indexOf(propre[i + 3] ?? 'A')
    if (position < longueur) octets[position++] = (bloc >> 16) & 255
    if (position < longueur) octets[position++] = (bloc >> 8) & 255
    if (position < longueur) octets[position++] = bloc & 255
  }
  return octets
}
