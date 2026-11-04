import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import LoginRedirectService from '#services/login_redirect_service'
import LoginService from '#services/login_service'
import PasskeyService from '#services/passkey_service'
import { PasskeyVerificationFailedException } from '#exceptions/passkey_errors'
import { authenticatePasskeyValidator } from '#validators/passkey'

/** Connexion par passkey, sans mot de passe ni saisie d'email (routes `guest`). */
@inject()
export default class PasskeySessionController {
  constructor(
    private service: PasskeyService,
    private loginRedirect: LoginRedirectService,
    private login: LoginService
  ) {}

  async options({ session, response }: HttpContext) {
    return response.json(await this.service.authenticationOptions(session))
  }

  async store(ctx: HttpContext) {
    const { request, auth, response, session, i18n } = ctx
    const { credential } = await request.validateUsing(authenticatePasskeyValidator)

    let user
    try {
      user = await this.service.authenticate(session, credential)
    } catch (error) {
      if (!(error instanceof PasskeyVerificationFailedException)) throw error

      session.flashErrors({ credential: i18n.t('auth.passkey.failed') })
      return response.redirect().back()
    }

    // Refuser la connexion d'un compte suspendu (#160).
    if (user.suspendedAt) {
      session.flashErrors({ credential: i18n.t('auth.suspended') })
      return response.redirect().back()
    }

    await auth.use('web').login(user)

    // Enregistrer la date de dernière connexion (#160).
    // Note : PasskeyService met déjà à jour lastUsedAt sur la passkey elle-même.
    await this.login.recordLogin(user)

    return this.loginRedirect.redirect(ctx, user)
  }
}
