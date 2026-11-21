import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { errors as authErrors } from '@adonisjs/auth'
import type { Authenticators } from '@adonisjs/auth/types'
import { loginPathFor } from '#shared/helpers/safe_redirect'

/**
 * Exige une session. Sans elle, renvoie vers la page de connexion **localisée**
 * avec `?redirect=` vers la page demandée (`loginPathFor`) : un lien reçu par
 * mail — devis à télécharger (#225), invitation… — mène à sa cible une fois
 * connecté, au lieu du tableau de bord. Un appel qui attend du JSON reçoit
 * toujours un 401.
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
    try {
      await ctx.auth.authenticateUsing(options.guards, { loginRoute })
    } catch (error) {
      if (!isPageRefusal(error, ctx)) throw error
      return redirectToLogin(ctx, error, loginRoute)
    }

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

/**
 * Refus faute de session que `@adonisjs/auth` résoudrait par une redirection
 * (requête qui n'attend pas de JSON — même test que son rendu « session »).
 */
function isPageRefusal(
  error: unknown,
  { request }: HttpContext
): error is InstanceType<typeof authErrors.E_UNAUTHORIZED_ACCESS> {
  const isUnauthorized = error instanceof authErrors.E_UNAUTHORIZED_ACCESS
  const wantsJson = ['json', 'application/vnd.api+json'].includes(
    String(request.accepts(['html', 'application/vnd.api+json', 'json']))
  )
  return isUnauthorized && !wantsJson
}

/**
 * Champs jamais remis en session flash : un formulaire envoyé après
 * l'expiration de la session ne doit pas y laisser de mot de passe.
 */
const UNFLASHED_FIELDS = ['_csrf', '_method', 'password', 'password_confirmation']

/**
 * Même réponse que le rendu « session » de `@adonisjs/auth` (messages flash,
 * redirection), **sans** reporter la query string de la requête refusée : elle
 * est déjà dans `redirect=`, et l'ajouter à nouveau (`withQs()`, avec
 * `forwardQueryString` activé) casserait l'URL de connexion. Les mots de passe
 * ne sont pas remis en session (`UNFLASHED_FIELDS`).
 */
function redirectToLogin(
  ctx: HttpContext,
  error: InstanceType<typeof authErrors.E_UNAUTHORIZED_ACCESS>,
  loginRoute: string
) {
  const message = error.getResponseMessage(error, ctx)
  ctx.session.flashExcept(UNFLASHED_FIELDS)
  ctx.session.flash('error', message)
  ctx.session.flashErrors({ [error.code ?? 'E_UNAUTHORIZED_ACCESS']: message })
  return ctx.response.redirect().withQs(false).toPath(loginRoute)
}
