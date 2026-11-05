import { DEFAULT_LOCALE, type Locale } from '../types/i18n.js'
import type { AnnouncementContent, AnnouncementTranslations } from '../types/announcement.js'

/**
 * Contenu à servir à un destinataire : sa langue, à défaut l'anglais, à défaut la
 * langue par défaut (toujours renseignée à la création).
 */
export function pickAnnouncementContent(
  translations: AnnouncementTranslations,
  locale: Locale
): AnnouncementContent {
  return (
    translations[locale] ??
    translations.en ??
    translations[DEFAULT_LOCALE] ?? { title: '', body: '' }
  )
}
