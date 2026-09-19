import { etatSemaine } from '@/services/pointsVue'

// The points tile of B1: a week that paid nothing is not an account that has never been paid.

const points = (cumul: number, cette_semaine: number) => ({
  solde: cumul,
  cumul,
  cette_semaine,
  formule: 'gratuit',
})

describe('etatSemaine', () => {
  it('shows the gain when the week paid something', () => {
    expect(etatSemaine(points(300, 50))).toBe('gain')
  })

  it('says the week is empty to someone who already has points', () => {
    expect(etatSemaine(points(300, 0))).toBe('vide')
  })

  it('tells someone with nothing where points come from', () => {
    expect(etatSemaine(points(0, 0))).toBe('aucun')
    expect(etatSemaine(undefined)).toBe('aucun')
  })
})
