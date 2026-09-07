import { rotationsPour } from '@/components/AnneauProgression'

describe('rotationsPour', () => {
  it('fills the right half first, then the left one', () => {
    expect(rotationsPour(0)).toEqual({ droite: -135, gauche: null })
    expect(rotationsPour(0.25)).toEqual({ droite: -45, gauche: null })
    expect(rotationsPour(0.5)).toEqual({ droite: 45, gauche: null })
    expect(rotationsPour(0.75)).toEqual({ droite: 45, gauche: 135 })
    expect(rotationsPour(1)).toEqual({ droite: 45, gauche: 225 })
  })

  it('clamps out-of-range progress', () => {
    expect(rotationsPour(-1)).toEqual(rotationsPour(0))
    expect(rotationsPour(3)).toEqual(rotationsPour(1))
  })
})
