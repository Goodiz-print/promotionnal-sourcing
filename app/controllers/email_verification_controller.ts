import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import EmailVerificationService from '#services/email_verification_service'
import { EMAIL_VERIFICATION_SIGNATURE_PURPOSE } from '#shared/types/auth'

/**
 * Vérification de l'adresse email : écran bloquant, lien signé reçu par mail et
 * renvoi (cf. `EmailVerificationService`).
 */
@inject()
export default class EmailVerificationController {
  constructor(private service: EmailVerificationService) {}

  /** Écran « vérifiez votre email » ; un compte déjà vérifié n'a rien à y faire. */
  async notice({ auth, inertia, response, i18n }: HttpContext) {
    const user = auth.getUserOrFail()
    if (user.emailVerifiedAt) {
      return response.redirect().toRoute('home', { locale: i18n.locale })
    }

    return inertia.render('auth/verify_email', { email: user.email })
  }

  /**
   * Cible du lien reçu par mail. Volontairement **hors `auth`** : l'utilisateur
   * peut ouvrir le lien dans un autre navigateur que celui de son inscription.
   */
  async verify({ request, auth, response, session, i18n }: HttpContext) {
    const user = request.hasValidSignature(EMAIL_VERIFICATION_SIGNATURE_PURPOSE)
      ? await this.service.verify(Number(request.param('id')), request.qs().v)
      : null

    if (!user) {
      session.flash('error', i18n.t('auth.verify.invalidLink'))
      return response.redirect().withQs(false).toRoute('session.create', { locale: i18n.locale })
    }

    session.flash('success', i18n.t('auth.verify.done'))
    const isCurrentUser = auth.user?.id === user.id
    const route = isCurrentUser && !user.currentOrganizationId ? 'onboarding.show' : 'home'
    return response
      .redirect()
      .withQs(false)
      .toRoute(isCurrentUser ? route : 'session.create', { locale: i18n.locale })
  }

  async resend({ auth, response, session, i18n }: HttpContext) {
    await this.service.send(auth.getUserOrFail(), i18n.locale)

    session.flash('success', i18n.t('auth.verify.resent'))
    return response.redirect().back()
  }
}
