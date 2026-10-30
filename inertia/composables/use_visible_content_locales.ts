import { computed, ref, watch, type Ref } from 'vue'
import { CONTENT_LOCALES, type ContentLocale } from '#shared/types/i18n'

/**
 * Langues de contenu affichées dans un formulaire de saisie : la langue source,
 * plus une autre langue au choix (les 32 blocs de champs ne tiennent pas à
 * l'écran). Les valeurs des langues non affichées restent dans l'état du
 * formulaire et sont envoyées comme avant.
 */
export function useVisibleContentLocales(source: Ref<ContentLocale>) {
  const defaultOther = (): ContentLocale => CONTENT_LOCALES.find((l) => l !== source.value)!

  const otherLocale = ref<ContentLocale>(defaultOther())

  // Changer la langue source pour la langue affichée l'en retire : on en propose une autre.
  watch(source, () => {
    if (otherLocale.value === source.value) otherLocale.value = defaultOther()
  })

  const otherLocales = computed(() => CONTENT_LOCALES.filter((l) => l !== source.value))
  const visibleLocales = computed<ContentLocale[]>(() => [source.value, otherLocale.value])

  return { otherLocale, otherLocales, visibleLocales }
}
