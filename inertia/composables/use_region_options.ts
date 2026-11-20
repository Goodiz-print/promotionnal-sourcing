import { computed } from 'vue'
import { useI18n } from '~/i18n'
import { COUNTRY_CODES, type CountryCode } from '#shared/types/country'
import { SUPPORTED_LOCALES, type Locale } from '#shared/types/i18n'

/**
 * Options de pays et de langues, nommées dans la langue de la page avec
 * `Intl.DisplayNames` (aucune traduction à maintenir), triées par nom.
 */
export function useRegionOptions() {
  const { locale } = useI18n()

  const regionNames = computed(() => new Intl.DisplayNames([locale.value], { type: 'region' }))
  const languageNames = computed(() => new Intl.DisplayNames([locale.value], { type: 'language' }))

  const byLabel = (a: { label: string }, b: { label: string }) =>
    a.label.localeCompare(b.label, locale.value)

  const countryOptions = computed(() =>
    COUNTRY_CODES.map((code): { value: CountryCode; label: string } => ({
      value: code,
      label: regionNames.value.of(code) ?? code,
    })).sort(byLabel)
  )

  const languageOptions = computed(() =>
    SUPPORTED_LOCALES.map((code): { value: Locale; label: string } => ({
      value: code,
      label: languageNames.value.of(code) ?? code,
    })).sort(byLabel)
  )

  const countryName = (code: string) => regionNames.value.of(code) ?? code
  const languageName = (code: string) => languageNames.value.of(code) ?? code

  return { countryOptions, languageOptions, countryName, languageName }
}
