import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { onboardingValidator } from '#validators/onboarding'
import OnboardingService from '#services/onboarding_service'

@inject()
export default class OnboardingController {
  constructor(private service: OnboardingService) {}

  /**
   * Écran d'onboarding (choix acheteur/fournisseur + nom d'organisation).
   * Un utilisateur déjà rattaché à une organisation est renvoyé à l'accueil.
   */
  async show({ auth, inertia, response, i18n }: HttpContext) {
    const user = auth.getUserOrFail()
    if (user.currentOrganizationId) {
      return response.redirect().toRoute('home', { locale: i18n.locale })
    }

    return inertia.render('onboarding/index', {})
  }

  /**
   * Crée la première organisation de l'utilisateur puis le redirige à l'accueil.
   */
  async store({ auth, request, response, i18n, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(onboardingValidator)

    await this.service.completeOnboarding(user, payload)

    session.flash('success', i18n.t('onboarding.success'))
    return response.redirect().toRoute('home', { locale: i18n.locale })
  }
}
