import {
  arrondir,
  evolutionAppuis,
  initialeJour,
  moinsDAppuis,
  positionDebit,
  zoneDebit,
} from '@/services/progresVue'
import { lireHeure, planifier } from '@/services/rappels'

describe('evolutionAppuis', () => {
  const semaines = [
    { semaine: '2026-07-27', prises: 2, par_type: { euh: 28, 'du coup': 18 } },
    { semaine: '2026-08-03', prises: 0, par_type: {} },
    { semaine: '2026-08-31', prises: 3, par_type: { euh: 15, 'du coup': 9, 'en fait': 12 } },
  ]

  it('reads per take, first week with takes against the last, most used words first', () => {
    expect(evolutionAppuis(semaines)).toEqual([
      { mot: 'euh', avant: 14, apres: 5 },
      { mot: 'du coup', avant: 9, apres: 3 },
      { mot: 'en fait', avant: 0, apres: 4 },
    ])
    expect(moinsDAppuis(evolutionAppuis(semaines))).toBe(true)
  })

  it('is empty without an analysed take', () => {
    expect(evolutionAppuis([])).toEqual([])
    expect(moinsDAppuis([])).toBe(false)
  })
})

describe('the pace bar', () => {
  it('names the zone that carries', () => {
    expect(zoneDebit(121)).toBe('pose')
    expect(zoneDebit(140)).toBe('zone')
    expect(zoneDebit(160)).toBe('presse')
  })

  it('clamps the marker between the ends of the bar', () => {
    expect(positionDebit(80)).toBe(0)
    expect(positionDebit(200)).toBe(1)
    expect(positionDebit(140)).toBeCloseTo(0.5)
    expect(positionDebit(20)).toBe(0)
  })

  it('formats through Intl with a French comma', () => {
    expect(arrondir(null)).toBe('·')
    expect(arrondir(148.4)).toBe('148')
    expect(arrondir(2.25, 1)).toBe('2,3')
  })

  it('gives the initial of a day', () => {
    expect(initialeJour('2026-09-07')).toBe('L')
    expect(initialeJour('2026-09-06')).toBe('D')
  })
})

describe('planifier', () => {
  const base = {
    notif_rappel: true,
    heure_rappel: '21:30:00',
    notif_serie: true,
    heure_alerte_serie: 20,
    validee_aujourdhui: false,
  }
  const midi = new Date(2026, 8, 6, 12, 0, 0)

  it('schedules the daily reminder at the chosen hour and the alert this evening', () => {
    const plan = planifier(base, midi)
    expect(plan.quotidien).toEqual({ heure: 21, minute: 30 })
    expect(plan.alerte?.getHours()).toBe(20)
    expect(plan.alerte?.getDate()).toBe(6)
  })

  it('drops the alert once today is validated, or when the hour is past, or when switched off', () => {
    expect(planifier({ ...base, validee_aujourdhui: true }, midi).alerte).toBeNull()
    expect(planifier(base, new Date(2026, 8, 6, 20, 30, 0)).alerte).toBeNull()
    expect(planifier({ ...base, notif_serie: false }, midi).alerte).toBeNull()
  })

  it('drops the reminder when switched off and survives a broken hour', () => {
    expect(planifier({ ...base, notif_rappel: false }, midi).quotidien).toBeNull()
    expect(lireHeure('bidon')).toEqual({ heure: 21, minute: 30 })
    expect(lireHeure('07:05')).toEqual({ heure: 7, minute: 5 })
  })
})
