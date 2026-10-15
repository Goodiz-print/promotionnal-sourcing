import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Bloque l'accès tant que l'adresse email de l'utilisateur n'est pas vérifiée :
 * redirige vers l'écran « vérifiez votre email ». À placer après `auth` et
 * **avant** `onboarded` ; jamais sur l'écran de vérification lui-même, son
 * renvoi ni la déconnexion.
 */
export default class EmailVerifiedMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.user
    if (user && !user.emailVerifiedAt) {
      return ctx.response.redirect().toRoute('email.notice', { locale: ctx.i18n.locale })
    }

    return next()
  }
}
