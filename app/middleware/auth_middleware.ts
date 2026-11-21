import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'
import { loginPathFor } from '#shared/helpers/safe_redirect'

/**
 * Exige une session. Sans elle, renvoie vers la page de connexion **localisée**
 * avec `?redirect=` vers la page demandée (`loginPathFor`) : un lien reçu par
 * mail — devis à télécharger (#225), invitation… — mène à sa cible une fois
 * connecté, au lieu du tableau de bord.
 */
export default class AuthMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: { guards?: (keyof Authenticators)[] } = {}
  ) {
    const loginRoute = loginPathFor({
      locale: ctx.i18n.locale,
      method: ctx.request.method(),
      path: ctx.request.url(true),
      isNavigation: isNavigation(ctx),
    })
    await ctx.auth.authenticateUsing(options.guards, { loginRoute })

    // Invalider la session d'un compte suspendu (#160).
    const user = ctx.auth.user
    if (user?.suspendedAt) {
      await ctx.auth.use('web').logout()
      ctx.session.flash('error', ctx.i18n.t('auth.suspended'))
      return ctx.response.redirect().toRoute('session.create', { locale: ctx.i18n.locale })
    }

    return next()
  }
}

/**
 * Navigation d'une page : visite Inertia, ou requête qui préfère le HTML au
 * JSON (même règle que `HttpExceptionHandler#expectsPage`).
 */
function isNavigation({ request }: HttpContext): boolean {
  return Boolean(request.header('x-inertia')) || request.accepts(['html', 'json']) === 'html'
}
