import User from '#models/user'
import { signupValidator } from '#validators/user'
import { isSafeRedirectPath } from '#shared/helpers/safe_redirect'
import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import EmailVerificationService from '#services/email_verification_service'
import type { HttpContext } from '@adonisjs/core/http'

@inject()
export default class NewAccountController {
  constructor(private emailVerification: EmailVerificationService) {}

  /**
   * `redirect`/`email` transportés en query string (ex. lien d'invitation
   * pour un email sans compte) : préremplissage + retour après inscription.
   */
  async create({ request, inertia }: HttpContext) {
    const { redirect, email } = request.qs()
    return inertia.render('auth/signup', {
      redirect: isSafeRedirectPath(redirect) ? redirect : null,
      email: typeof email === 'string' ? email : null,
    })
  }

  async store({ request, response, auth, i18n }: HttpContext) {
    const payload = await request.validateUsing(signupValidator)
    const user = await User.create({ ...payload })

    await auth.use('web').login(user)
    // Un échec de mise en queue ne doit pas défaire l'inscription : le compte
    // existe et l'écran de vérification propose de renvoyer le mail.
    try {
      await this.emailVerification.send(user, i18n.locale)
    } catch (error) {
      logger.warn({ err: error, userId: user.id }, 'email verification mail could not be queued')
    }

    const { redirect } = request.qs()
    if (isSafeRedirectPath(redirect)) {
      // `withQs(false)` : le projet active `forwardQueryString: true` par
      // défaut (config/app.ts) — sans ça, la querystring de CETTE requête
      // (`?redirect=...`) serait rajoutée à la cible au lieu d'être remplacée.
      return response.redirect().withQs(false).toPath(redirect)
    }
    // Nouveau compte = adresse à vérifier avant l'onboarding. `withQs(false)` :
    // ne jamais faire fuiter un `?redirect=...` non sûr vers la destination.
    response.redirect().withQs(false).toRoute('email.notice', { locale: i18n.locale })
  }
}
