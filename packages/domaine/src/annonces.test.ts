import { describe, expect, it } from 'vitest'

import { cheminMedia, urlMedia, verifierMedia } from './annonces.js'

describe('verifierMedia', () => {
  it('accepts the formats a phone and a browser both read', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/avif']) {
      expect(verifierMedia({ type, size: 1000 })).toBeNull()
    }
  })

  it('refuses anything that is not one of them, by type and not by extension', () => {
    expect(verifierMedia({ type: 'image/gif', size: 10 })).toBe('type')
    expect(verifierMedia({ type: 'application/pdf', size: 10 })).toBe('type')
    expect(verifierMedia({ type: '', size: 10 })).toBe('type')
  })

  it('refuses an image heavier than the bucket accepts', () => {
    expect(verifierMedia({ type: 'image/png', size: 5 * 1024 * 1024 })).toBeNull()
    expect(verifierMedia({ type: 'image/png', size: 5 * 1024 * 1024 + 1 })).toBe('taille')
  })
})

describe('cheminMedia', () => {
  it('files each image under its own kind, named by the row it belongs to', () => {
    expect(cheminMedia('ateliers', 'abc', 'image/png')).toBe('ateliers/abc.png')
    expect(cheminMedia('annonces', 'def', 'image/webp')).toBe('annonces/def.webp')
  })

  it('writes jpeg as jpg, the way every other tool does', () => {
    expect(cheminMedia('recompenses', 'ghi', 'image/jpeg')).toBe('recompenses/ghi.jpg')
  })

  it('never keeps the uploaded file name', () => {
    const chemin = cheminMedia('ateliers', 'id-genere', 'image/png')
    expect(chemin).not.toMatch(/capture|screenshot|img_/i)
  })
})

describe('urlMedia', () => {
  it('builds the public address from the path the row holds', () => {
    expect(urlMedia('https://x.supabase.co', 'ateliers/a.png')).toBe(
      'https://x.supabase.co/storage/v1/object/public/medias/ateliers/a.png',
    )
  })

  it('tolerates a trailing slash on the project address', () => {
    expect(urlMedia('https://x.supabase.co/', 'a.png')).toContain('.co/storage/')
  })

  it('answers nothing when there is no image, so a screen shows no broken frame', () => {
    expect(urlMedia('https://x.supabase.co', null)).toBeNull()
  })
})
