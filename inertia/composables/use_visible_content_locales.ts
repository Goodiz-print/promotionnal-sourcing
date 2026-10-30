import { computed, ref, watch, type Ref } from 'vue'
import { CONTENT_LOCALES, type ContentLocale } from '#shared/types/i18n'

const ERROR_LOCALE = /^translations\.([^.]+)\./

function isContentLocale(value: string): value is ContentLocale {
  return (CONTENT_LOCALES as readonly string[]).includes(value)
}

/**
 * Langues de contenu affichées dans un formulaire de saisie : la langue source,
 * plus une autre langue au choix (les 32 blocs de champs ne tiennent pas à
 * l'écran). Les valeurs des langues non affichées restent dans l'état du
 * formulaire et sont envoyées comme avant.
 *
 * Une erreur de validation (`translations.<locale>.<champ>`) sur une langue
 * masquée bascule l'affichage sur cette langue, pour qu'elle soit visible.
 */
export function useVisibleContentLocales(
  source: Ref<ContentLocale>,
  errors: () => Record<string, string | undefined>
) {
  const firstOther = (): ContentLocale =>
    CONTENT_LOCALES.find((locale) => locale !== source.value) ?? source.value

  const otherLocale = ref<ContentLocale>(firstOther())

  // Changer la langue source pour la langue affichée l'en retire : on en propose une autre.
  watch(source, () => {
    if (otherLocale.value === source.value) otherLocale.value = firstOther()
  })

  watch(
    errors,
    (current) => {
      const hidden = Object.keys(current)
        .map((key) => ERROR_LOCALE.exec(key)?.[1])
        .find(
          (locale): locale is ContentLocale =>
            locale !== undefined && isContentLocale(locale) && locale !== source.value
        )
      if (hidden && hidden !== otherLocale.value) otherLocale.value = hidden
    },
    { deep: true }
  )

  const otherLocales = computed(() => CONTENT_LOCALES.filter((locale) => locale !== source.value))
  const visibleLocales = computed<ContentLocale[]>(() => [source.value, otherLocale.value])

  return { otherLocale, otherLocales, visibleLocales }
}
