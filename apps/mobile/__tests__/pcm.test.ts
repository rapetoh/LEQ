import { depuisBase64, depuisInt16, enBase64, versInt16 } from '@/services/pcm'

// The conversions on the debate's audio path. They are pure, they run on every 100 ms frame,
// and a sign or endianness mistake here is inaudible until the transcription is nonsense.

describe('versInt16', () => {
  it('maps the full range without wrapping around', () => {
    const octets = versInt16(new Float32Array([0, 1, -1]))
    const vue = new DataView(octets.buffer)
    expect(vue.getInt16(0, true)).toBe(0)
    expect(vue.getInt16(2, true)).toBe(32767)
    expect(vue.getInt16(4, true)).toBe(-32767)
  })

  it('clamps anything louder than full scale instead of overflowing', () => {
    const octets = versInt16(new Float32Array([4, -4]))
    const vue = new DataView(octets.buffer)
    expect(vue.getInt16(0, true)).toBe(32767)
    expect(vue.getInt16(2, true)).toBe(-32767)
  })

  it('writes little-endian, which is what every transcriber expects', () => {
    const octets = versInt16(new Float32Array([1 / 32768]))
    expect([octets[0], octets[1]]).toEqual([1, 0])
  })

  it('produces two bytes per sample', () => {
    expect(versInt16(new Float32Array(800)).length).toBe(1600)
  })
})

describe('a round trip through the wire', () => {
  it('brings the samples back where they started', () => {
    const original = new Float32Array([0, 0.5, -0.5, 0.25])
    const retour = depuisInt16(depuisBase64(enBase64(versInt16(original))))
    expect(retour.length).toBe(original.length)
    for (let i = 0; i < original.length; i += 1) {
      expect(retour[i]).toBeCloseTo(original[i] ?? 0, 4)
    }
  })

  it('survives a frame of the size the microphone actually sends', () => {
    const trame = new Float32Array(1600)
    for (let i = 0; i < trame.length; i += 1) trame[i] = Math.sin(i / 20) * 0.8
    const retour = depuisInt16(depuisBase64(enBase64(versInt16(trame))))
    expect(retour.length).toBe(1600)
    expect(retour[100]).toBeCloseTo(trame[100] ?? 0, 3)
  })
})

describe('enBase64', () => {
  it('encodes the way every other base64 does', () => {
    expect(enBase64(new Uint8Array([77, 97, 110]))).toBe('TWFu')
    expect(enBase64(new Uint8Array([77, 97]))).toBe('TWE=')
    expect(enBase64(new Uint8Array([77]))).toBe('TQ==')
    expect(enBase64(new Uint8Array([]))).toBe('')
  })

  it('reads back what it wrote, padding included', () => {
    for (const octets of [[77], [77, 97], [77, 97, 110], [0, 255, 128, 1]]) {
      expect(Array.from(depuisBase64(enBase64(new Uint8Array(octets))))).toEqual(octets)
    }
  })
})

describe('depuisInt16', () => {
  it('ignores a trailing odd byte rather than reading past the end', () => {
    expect(depuisInt16(new Uint8Array([1, 0, 7])).length).toBe(1)
  })

  it('answers nothing for nothing', () => {
    expect(depuisInt16(new Uint8Array([])).length).toBe(0)
  })
})
