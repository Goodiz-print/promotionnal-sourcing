import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import OrganizationContextService from '#services/organization_context_service'

/**
 * Empêche l'accès aux écrans nécessitant une organisation tant que
 * l'utilisateur n'en a aucune d'utilisable. À placer après `auth` sur les
 * routes concernées (jamais sur l'onboarding).
 *
 * « Utilisable » couvre trois cas au-delà de l'absence d'organisation
 * courante : l'organisation a été **archivée**, l'utilisateur en a été
 * **retiré**, ou il vient de la **quitter**. Dans ces cas on bascule
 * silencieusement sur une autre de ses organisations, et on ne renvoie vers
 * l'onboarding qu'en dernier recours.
 */
@inject()
export default class OnboardedMiddleware {
  constructor(private context: OrganizationContextService) {}

  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.user
    if (user && !(await this.context.ensureUsableOrganization(user))) {
      return ctx.response.redirect().toRoute('onboarding.show', { locale: ctx.i18n.locale })
    }

    return next()
  }
}
