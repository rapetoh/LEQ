import { fr, t } from '@/i18n/fr'

describe('t', () => {
  it('returns the plain string for a nested key', () => {
    expect(t('accueil.bienvenue.titre')).toBe('Découvre quel orateur tu es.')
    expect(t('onglets.arene')).toBe("L'Arène")
  })

  it('interpolates {{params}}', () => {
    expect(t('aujourdhui.salutation', { prenom: 'Camille' })).toBe('Salut, Camille')
    expect(t('aujourdhui.points', { points: 25 })).toBe('+25 pts')
    expect(t('accueil.micro.note', { systeme: 'iOS' })).toBe(
      'iOS te demandera confirmation juste après',
    )
  })

  it('leaves a placeholder untouched when its param is missing', () => {
    expect(t('envoi.echec.serieIntacte')).toBe('Série de {{jours}} jours : intacte')
  })

  it('contains no em dash anywhere', () => {
    const tout = JSON.stringify(fr)
    expect(tout.includes('—')).toBe(false)
  })
})
