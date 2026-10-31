import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Réserve un groupe de routes (`/admin/**`) à l'équipe plateforme. À placer
 * après `auth` : un visiteur anonyme est déjà renvoyé vers la connexion, un
 * utilisateur connecté sans rôle plateforme reçoit un 403 (droit
 * `backoffice.access`), quel que soit son rôle dans ses organisations.
 *
 * Porte d'entrée seulement : chaque contrôleur autorise ensuite le droit précis
 * de sa section (`hasPlatformPermission`), car les rôles fins (modérateur,
 * support, analyste) n'ont pas accès à tout.
 */
export default class PlatformAdminMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    await ctx.bouncer.authorize('hasPlatformPermission', 'backoffice.access')
    return next()
  }
}
