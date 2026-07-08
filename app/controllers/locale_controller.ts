import type { HttpContext } from '@adonisjs/core/http'
import { updateLocaleValidator } from '#validators/locale'
import { LOCALE_COOKIE, type Locale } from '#shared/types/i18n'

export default class LocaleController {
  /**
   * Change la langue active pour le visiteur.
   *
   * Persiste le choix dans un cookie (visiteurs anonymes) et sur
   * l'utilisateur authentifié le cas échéant, puis redirige vers l'URL
   * préfixée de la nouvelle langue (préfixe /:locale = source de vérité SEO).
   */
  async update({ request, response, auth }: HttpContext) {
    const { locale } = await request.validateUsing(updateLocaleValidator)

    response.cookie(LOCALE_COOKIE, locale, { maxAge: '1y', sameSite: 'lax' })

    if (auth.user) {
      auth.user.locale = locale
      await auth.user.save()
    }

    return response.redirect(this.localizedPath(request.header('referer'), locale))
  }

  /**
   * Reconstruit le chemin de la page d'origine dans la locale choisie :
   * remplace le segment de locale existant, ou le préfixe s'il est absent.
   */
  private localizedPath(referer: string | undefined, locale: Locale): string {
    let path = '/'
    if (referer) {
      try {
        path = new URL(referer).pathname
      } catch {
        path = referer.startsWith('/') ? referer : '/'
      }
    }

    if (/^\/(fr|en)(\/|$)/.test(path)) {
      return path.replace(/^\/(fr|en)/, `/${locale}`)
    }

    return `/${locale}${path === '/' ? '' : path}`
  }
}
