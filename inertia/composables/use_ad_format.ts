import { useI18n } from '~/i18n'
import { formatMoney } from '~/components/quotes/types'
import { formatDateTime } from '#shared/helpers/date'
import { AD_CURRENCY } from '#shared/types/ads'

/**
 * Formatage des écrans de produits sponsorisés : montants en centimes affichés en devise,
 * jours ISO et horodatages dans la langue courante.
 */
export function useAdFormat() {
  const { locale } = useI18n()

  const money = (cents: number) => formatMoney(cents / 100, AD_CURRENCY, locale.value)

  /** Jour ISO (`AAAA-MM-JJ`), lu à midi pour ne pas glisser d'un jour selon le fuseau. */
  const day = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(locale.value, { dateStyle: 'medium' })

  const dateTime = (iso: string) => formatDateTime(iso, locale.value)

  return { money, day, dateTime }
}
