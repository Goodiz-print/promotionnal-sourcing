import { useI18n } from '~/i18n'
import { formatMoney } from '~/components/quotes/types'
import { formatDateTime } from '#shared/helpers/date'

const EMPTY = '—'

/**
 * Formatage des écrans de supervision : montants décimaux (chaînes) + devise et
 * horodatages ISO, dans la langue courante. Une valeur absente s'affiche « — ».
 */
export function useTradeFormat() {
  const { locale } = useI18n()

  const money = (amount: string | null, currency: string) =>
    amount === null ? EMPTY : formatMoney(Number(amount), currency, locale.value)

  const dateTime = (value: string | null) => (value ? formatDateTime(value, locale.value) : EMPTY)

  return { money, dateTime, empty: EMPTY }
}
