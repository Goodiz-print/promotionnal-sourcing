import app from '@adonisjs/core/services/app'
import { defineConfig, formatters, loaders } from '@adonisjs/i18n'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '#shared/types/i18n'

const i18nConfig = defineConfig({
  defaultLocale: DEFAULT_LOCALE,
  formatter: formatters.icu(),

  /**
   * Locales explicitement supportées. Toute langue en dehors de
   * cette liste retombe sur la locale par défaut (français).
   */
  supportedLocales: [...SUPPORTED_LOCALES],

  /**
   * Rattache les variantes régionales à leur locale de base.
   */
  fallbackLocales: {
    'fr-FR': 'fr',
    'fr-CA': 'fr',
    'fr-BE': 'fr',
    'fr-CH': 'fr',
    'en-US': 'en',
    'en-GB': 'en',
  },

  loaders: [
    /**
     * Le loader fs lit les traductions depuis le dossier
     * "resources/lang".
     *
     * Chaque sous-dossier représente une locale et chaque fichier
     * un domaine. Par exemple :
     *   - "resources/lang/fr/common.json"
     *   - "resources/lang/en/common.json"
     */
    loaders.fs({
      location: app.languageFilesPath(),
    }),
  ],
})

export default i18nConfig
