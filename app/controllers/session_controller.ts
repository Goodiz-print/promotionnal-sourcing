import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class SessionController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/login', {})
  }

  async store({ request, auth, response, i18n }: HttpContext) {
    const { email, password } = request.all()
    const user = await User.verifyCredentials(email, password)

    await auth.use('web').login(user)
    // Sans organisation courante → onboarding, sinon accueil.
    const route = user.currentOrganizationId ? 'home' : 'onboarding.show'
    response.redirect().toRoute(route, { locale: i18n.locale })
  }

  async destroy({ auth, response, i18n }: HttpContext) {
    await auth.use('web').logout()
    response.redirect().toRoute('session.create', { locale: i18n.locale })
  }
}
