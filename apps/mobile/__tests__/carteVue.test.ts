import { disposerNoeuds, gaucheEtiquette, hauteurCarte, tracer } from '@/services/carteVue'

describe('the map geometry', () => {
  it('zigzags the nodes like the mockup and spaces them down the land', () => {
    const points = disposerNoeuds(5, 354)
    expect(points.map((p) => p.x)).toEqual([60, 251, 99, 251, 60])
    expect(points.map((p) => p.y)).toEqual([128, 240, 352, 464, 576])
    expect(hauteurCarte(5)).toBe(676)
    expect(hauteurCarte(0)).toBe(180)
  })

  it('keeps the labels inside the land', () => {
    expect(gaucheEtiquette(60, 354)).toBe(4)
    expect(gaucheEtiquette(177, 354)).toBe(87)
    expect(gaucheEtiquette(340, 354)).toBe(170)
  })

  it('draws one S-curve per segment and nothing for an empty land', () => {
    expect(tracer([])).toBe('')
    expect(tracer([{ x: 60, y: 90 }])).toBe('M 60 90')
    expect(
      tracer([
        { x: 60, y: 90 },
        { x: 250, y: 170 },
      ]),
    ).toBe('M 60 90 C 60 138 250 122 250 170')
  })
})
