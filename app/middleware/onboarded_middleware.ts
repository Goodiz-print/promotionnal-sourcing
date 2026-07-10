import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Empêche l'accès aux écrans nécessitant une organisation tant que
 * l'utilisateur n'a pas terminé l'onboarding (aucune organisation courante).
 * À placer après `auth` sur les routes concernées (jamais sur l'onboarding).
 */
export default class OnboardedMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.user
    if (user && !user.currentOrganizationId) {
      return ctx.response.redirect().toRoute('onboarding.show', { locale: ctx.i18n.locale })
    }

    return next()
  }
}
