import { describe, expect, it } from 'vitest'

import { choisirTypeMime, raisonDe, TYPES_CANDIDATS } from './enregistrement'

describe('choisirTypeMime', () => {
  it('prefers mp4 when the browser writes it (Safari)', () => {
    expect(choisirTypeMime((type) => type.startsWith('audio/mp4'))).toBe('audio/mp4')
  })

  it('falls back to webm with Opus (Chrome, Firefox)', () => {
    expect(choisirTypeMime((type) => type.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus')
  })

  it('answers null when the browser writes none of them', () => {
    expect(choisirTypeMime(() => false)).toBeNull()
  })

  it('offers containers ffmpeg decodes, in order of preference', () => {
    expect(TYPES_CANDIDATS[0]).toBe('audio/mp4')
    expect(TYPES_CANDIDATS).toContain('audio/webm;codecs=opus')
  })
})

describe('raisonDe', () => {
  it('separates a refusal from a missing microphone', () => {
    expect(raisonDe({ name: 'NotAllowedError' })).toBe('refuse')
    expect(raisonDe({ name: 'SecurityError' })).toBe('refuse')
    expect(raisonDe({ name: 'NotFoundError' })).toBe('absent')
    expect(raisonDe({ name: 'NotReadableError' })).toBe('occupe')
  })

  it('has a name for everything else', () => {
    expect(raisonDe(new Error('boom'))).toBe('inconnu')
    expect(raisonDe(null)).toBe('inconnu')
  })
})
