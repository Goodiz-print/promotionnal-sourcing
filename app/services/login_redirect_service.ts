import { isSafeRedirectPath } from '#shared/helpers/safe_redirect'
import type User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Destination après une connexion réussie (mot de passe ou passkey) : la page
 * visitée (`?redirect=`) si elle est sûre, sinon onboarding ou accueil.
 */
export default class LoginRedirectService {
  redirect({ request, response, i18n }: HttpContext, user: User) {
    const { redirect } = request.qs()
    if (isSafeRedirectPath(redirect)) {
      // `withQs(false)` : le projet active `forwardQueryString: true` par
      // défaut (config/app.ts) — sans ça, la querystring de CETTE requête
      // (`?redirect=...`) serait rajoutée à la cible au lieu d'être remplacée.
      return response.redirect().withQs(false).toPath(redirect)
    }
    // Sans organisation courante → onboarding, sinon accueil. `withQs(false)` :
    // ne jamais faire fuiter un `?redirect=...` non sûr vers la destination.
    const route = user.currentOrganizationId ? 'home' : 'onboarding.show'
    return response.redirect().withQs(false).toRoute(route, { locale: i18n.locale })
  }
}
