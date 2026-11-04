import { inject } from '@adonisjs/core'
import User from '#models/user'
import LoginRedirectService from '#services/login_redirect_service'
import LoginService from '#services/login_service'
import { clearLoginThrottle } from '#start/limiter'
import { isSafeRedirectPath } from '#shared/helpers/safe_redirect'
import type { HttpContext } from '@adonisjs/core/http'

@inject()
export default class SessionController {
  constructor(
    private loginRedirect: LoginRedirectService,
    private login: LoginService
  ) {}

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

  async store(ctx: HttpContext) {
    const { request, auth, session, i18n, response } = ctx
    const { email, password } = request.all()
    const user = await User.verifyCredentials(email, password)

    // Refuser la connexion d'un compte suspendu (#160).
    if (user.suspendedAt) {
      session.flashErrors({ email: i18n.t('auth.suspended') })
      return response.redirect().back()
    }

    await auth.use('web').login(user)
    // Seuls les échecs consécutifs comptent : une connexion réussie remet à zéro.
    await clearLoginThrottle(ctx)

    // Enregistrer la date de dernière connexion (#160).
    await this.login.recordLogin(user)

    return this.loginRedirect.redirect(ctx, user)
  }

  async destroy({ auth, response, i18n }: HttpContext) {
    await auth.use('web').logout()
    response.redirect().toRoute('session.create', { locale: i18n.locale })
  }
}
