import { useI18n } from '~/i18n'
import { CONTACT_EMAIL, type MarketingPage } from '#shared/types/marketing'

/**
 * Aides communes aux pages de la landing : chemins préfixés par la locale
 * courante (`/fr/contact`) et ancres de l'accueil (`/fr#agences`).
 */
export function useMarketing() {
  const { t, locale } = useI18n()

  function path(page: '' | MarketingPage = ''): string {
    return `/${locale.value}${page ? `/${page}` : ''}`
  }

  /** Ancre de l'accueil, utilisable depuis n'importe quelle page de la landing. */
  function homeAnchor(hash: string): string {
    return `${path()}#${hash}`
  }

  return { t, locale, path, homeAnchor, email: CONTACT_EMAIL }
}
