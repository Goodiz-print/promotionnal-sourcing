import { computed, type App } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { IntlMessageFormat } from 'intl-messageformat'
import type { Data } from '@generated/data'
import { DEFAULT_LOCALE, type Locale, type Translations } from '#shared/types/i18n'

/**
 * Valeurs interpolables dans un message ICU (ex: { count }, { name }).
 */
export type TranslateData = Record<string, string | number | boolean | Date>

/**
 * Cache des formatteurs ICU. Instancier un IntlMessageFormat est coûteux,
 * on mémoïse donc par couple locale + clé.
 */
const formatterCache = new Map<string, IntlMessageFormat>()

/**
 * Résout une clé de traduction dans le dictionnaire fourni et applique
 * le formatage ICU (interpolation, pluriels, dates…) si nécessaire.
 *
 * Retourne la clé elle-même lorsqu'aucune traduction n'est trouvée, ce
 * qui rend les oublis visibles sans faire planter le rendu.
 */
export function translate(
  translations: Translations,
  locale: Locale,
  key: string,
  data?: TranslateData
): string {
  const message = translations[key]
  if (message === undefined) {
    return key
  }

  // Pas de placeholder ICU : on évite le coût du parsing.
  if (!message.includes('{')) {
    return message
  }

  const cacheKey = `${locale}::${key}`
  let formatter = formatterCache.get(cacheKey)
  if (!formatter) {
    formatter = new IntlMessageFormat(message, locale)
    formatterCache.set(cacheKey, formatter)
  }

  return String(formatter.format(data))
}

function readSharedProps() {
  const props = usePage<Data.SharedProps>().props
  const locale = (props.locale ?? DEFAULT_LOCALE) as Locale
  const translations = (props.translations ?? {}) as Translations
  return { locale, translations }
}

/**
 * Composable i18n pour le `<script setup>`.
 *
 * @example
 * const { t, locale } = useI18n()
 * t('auth.login.title')
 * t('common.greeting', { name: user.fullName })
 */
export function useI18n() {
  const locale = computed<Locale>(() => readSharedProps().locale)

  function t(key: string, data?: TranslateData): string {
    const { locale: currentLocale, translations } = readSharedProps()
    return translate(translations, currentLocale, key, data)
  }

  return { t, locale }
}

/**
 * Plugin Vue exposant `t()` comme propriété globale, utilisable
 * directement dans les templates : {{ t('common.nav.login') }}
 */
export const i18nPlugin = {
  install(app: App) {
    app.config.globalProperties.t = (key: string, data?: TranslateData): string => {
      const { locale, translations } = readSharedProps()
      return translate(translations, locale, key, data)
    }
  },
}

declare module 'vue' {
  interface ComponentCustomProperties {
    t: (key: string, data?: TranslateData) => string
  }
}
