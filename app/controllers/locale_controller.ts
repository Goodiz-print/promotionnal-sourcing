import type { HttpContext } from '@adonisjs/core/http'
import { updateLocaleValidator } from '#validators/locale'
import { LOCALE_COOKIE } from '#shared/types/i18n'

export default class LocaleController {
  /**
   * Change la langue active pour le visiteur.
   *
   * Persiste le choix dans un cookie (visiteurs anonymes) et sur
   * l'utilisateur authentifié le cas échéant, puis renvoie sur la
   * page précédente afin de la re-rendre dans la nouvelle langue.
   */
  async update({ request, response, auth }: HttpContext) {
    const { locale } = await request.validateUsing(updateLocaleValidator)

    response.cookie(LOCALE_COOKIE, locale, { maxAge: '1y', sameSite: 'lax' })

    if (auth.user) {
      auth.user.locale = locale
      await auth.user.save()
    }

    return response.redirect().back()
  }
}
