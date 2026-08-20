import User from '#models/user'
import { isSafeRedirectPath } from '#shared/helpers/safe_redirect'
import type { HttpContext } from '@adonisjs/core/http'

export default class SessionController {
  /**
   * `redirect` transporté en query string (ex. lien d'invitation) : ramène
   * l'utilisateur sur la page qu'il visitait après connexion.
   */
  async create({ request, inertia }: HttpContext) {
    const { redirect } = request.qs()
    return inertia.render('auth/login', {
      redirect: isSafeRedirectPath(redirect) ? redirect : null,
    })
  }

  async store({ request, auth, response, i18n }: HttpContext) {
    const { email, password } = request.all()
    const user = await User.verifyCredentials(email, password)

    await auth.use('web').login(user)

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
    response.redirect().withQs(false).toRoute(route, { locale: i18n.locale })
  }

  async destroy({ auth, response, i18n }: HttpContext) {
    await auth.use('web').logout()
    response.redirect().toRoute('session.create', { locale: i18n.locale })
  }
}
