import { describe, expect, it, vi, afterEach } from 'vitest'

import { VoixOpenAI } from './voix.js'

// The voice the person chose has to be the voice the provider is asked for, and the provider's
// own preset names must not leak out of this file (2026-09-20, Roch: « maybe the user wants to
// hear the lady talk or a man »).

const config = { cle: 'sk-test', base: 'https://exemple.test' }

function interceptor() {
  const corps: Array<Record<string, unknown>> = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, options: { body: string }) => {
      corps.push(JSON.parse(options.body) as Record<string, unknown>)
      return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 })
    }),
  )
  return corps
}

async function vider(flux: AsyncIterable<Uint8Array>): Promise<number> {
  let octets = 0
  for await (const morceau of flux) octets += morceau.length
  return octets
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('la voix de Rétor', () => {
  it("parle d'une voix d'homme par défaut", async () => {
    const corps = interceptor()
    await vider(new VoixOpenAI(config).dire('Bonjour.'))
    expect(corps[0]).toMatchObject({ voice: 'onyx' })
    expect(String(corps[0]?.['instructions'])).toContain("Voix d'homme")
  })

  it("parle d'une voix de femme quand la personne l'a choisie", async () => {
    const corps = interceptor()
    await vider(new VoixOpenAI(config).dire('Bonjour.', undefined, 'femme'))
    expect(corps[0]).toMatchObject({ voice: 'sage' })
    expect(String(corps[0]?.['instructions'])).toContain('Voix de femme')
  })

  it('demande toujours du PCM, quelle que soit la voix', async () => {
    const corps = interceptor()
    await vider(new VoixOpenAI(config).dire('Bonjour.', undefined, 'femme'))
    expect(corps[0]).toMatchObject({ model: 'gpt-4o-mini-tts', response_format: 'pcm' })
  })
})
