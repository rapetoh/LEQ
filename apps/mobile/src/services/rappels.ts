// Local notifications of chapter 12: the daily reminder at the hour the person chose, and the
// streak alert in the evening when nothing was recorded today. Both honour the G3 switches and
// are recomputed whenever the app comes back or a take lands. Nothing leaves the phone.
import * as Notifications from 'expo-notifications'

import { t } from '@/i18n/fr'

export const ID_RAPPEL_QUOTIDIEN = 'rappel_quotidien'
export const ID_ALERTE_SERIE = 'alerte_serie'

export type ReglagesRappels = {
  notif_rappel: boolean
  /** `HH:MM` or `HH:MM:SS`, local time. */
  heure_rappel: string
  notif_serie: boolean
  /** Local hour of the streak alert (configuration `heure_alerte_serie`). */
  heure_alerte_serie: number
  validee_aujourdhui: boolean
}

export type PlanRappels = {
  quotidien: { heure: number; minute: number } | null
  /** The instant of today's streak alert, or null when it is not due (done, off, or past). */
  alerte: Date | null
}

export function lireHeure(heure: string): { heure: number; minute: number } {
  const [h, m] = heure.split(':')
  const hh = Number(h)
  const mm = Number(m)
  return {
    heure: Number.isInteger(hh) && hh >= 0 && hh <= 23 ? hh : 21,
    minute: Number.isInteger(mm) && mm >= 0 && mm <= 59 ? mm : 30,
  }
}

/** Pure: what should be scheduled right now. Tested. */
export function planifier(reglages: ReglagesRappels, maintenant: Date = new Date()): PlanRappels {
  const quotidien = reglages.notif_rappel ? lireHeure(reglages.heure_rappel) : null
  let alerte: Date | null = null
  if (reglages.notif_serie && !reglages.validee_aujourdhui) {
    const cible = new Date(maintenant)
    cible.setHours(reglages.heure_alerte_serie, 0, 0, 0)
    if (cible.getTime() > maintenant.getTime()) alerte = cible
  }
  return { quotidien, alerte }
}

async function permissionAccordee(): Promise<boolean> {
  try {
    return (await Notifications.getPermissionsAsync()).status === 'granted'
  } catch {
    return false
  }
}

/** Applies the plan to the system: cancels ours, schedules what is due. Best effort. */
export async function appliquerRappels(reglages: ReglagesRappels): Promise<PlanRappels> {
  const plan = planifier(reglages)
  if (!(await permissionAccordee())) return plan
  try {
    await Notifications.cancelScheduledNotificationAsync(ID_RAPPEL_QUOTIDIEN)
    await Notifications.cancelScheduledNotificationAsync(ID_ALERTE_SERIE)
    if (plan.quotidien) {
      await Notifications.scheduleNotificationAsync({
        identifier: ID_RAPPEL_QUOTIDIEN,
        content: { title: t('rappels.quotidienTitre'), body: t('rappels.quotidienCorps') },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: plan.quotidien.heure,
          minute: plan.quotidien.minute,
        },
      })
    }
    if (plan.alerte) {
      await Notifications.scheduleNotificationAsync({
        identifier: ID_ALERTE_SERIE,
        content: { title: t('rappels.serieTitre'), body: t('rappels.serieCorps') },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: plan.alerte },
      })
    }
  } catch (erreur) {
    console.warn('rappels: planification impossible', erreur)
  }
  return plan
}
