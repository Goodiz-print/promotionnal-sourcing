import { useI18n } from '~/i18n'
import type { KpiMetric } from '#shared/types/admin_kpi'

export type KpiFormat = 'count' | 'percent' | 'hours'

/** Au-delà de ce nombre d'heures, une durée s'affiche en jours. */
const HOURS_AS_DAYS_FROM = 48

/**
 * Formats des indicateurs du tableau de bord KPI : entier, pourcentage, durée
 * (heures, puis jours) et montant. `null` (indicateur non défini) s'affiche « — ».
 */
export function useKpiFormat() {
  const { t, locale } = useI18n()

  function value(amount: number | null, format: KpiFormat): string {
    if (amount === null) return t('admin.dashboard.kpi.none')
    if (format === 'percent') {
      return new Intl.NumberFormat(locale.value, {
        style: 'percent',
        maximumFractionDigits: 1,
      }).format(amount)
    }
    if (format === 'hours') {
      const days = amount >= HOURS_AS_DAYS_FROM
      return new Intl.NumberFormat(locale.value, {
        style: 'unit',
        unit: days ? 'day' : 'hour',
        unitDisplay: 'short',
        maximumFractionDigits: 1,
      }).format(days ? amount / 24 : amount)
    }
    return new Intl.NumberFormat(locale.value).format(amount)
  }

  function money(amount: number, currency: string): string {
    return new Intl.NumberFormat(locale.value, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  /** « Période précédente : 12 » sous la valeur courante. */
  function previous(metric: KpiMetric, format: KpiFormat): string {
    return t('admin.dashboard.kpi.previous', { value: value(metric.previous, format) })
  }

  return { value, money, previous }
}
