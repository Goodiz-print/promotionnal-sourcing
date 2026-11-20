import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import QuoteEmailVerificationService from '#services/quote_email_verification_service'
import { QUOTE_EMAIL_VERIFICATION_SIGNATURE_PURPOSE } from '#shared/types/rfq'

/**
 * Cible du lien de confirmation de l'adresse de réception des demandes de devis
 * (#217). Volontairement **hors `auth`** : la boîte qui reçoit le lien peut
 * être partagée et n'appartenir à aucun compte.
 */
@inject()
export default class QuoteEmailVerificationController {
  constructor(private service: QuoteEmailVerificationService) {}

  async verify({ request, auth, response, session, i18n }: HttpContext) {
    const profile = request.hasValidSignature(QUOTE_EMAIL_VERIFICATION_SIGNATURE_PURPOSE)
      ? await this.service.verify(Number(request.param('id')), request.qs().v)
      : null

    if (!profile) {
      session.flash('error', i18n.t('supplier.profile.quoteEmail.invalidLink'))
      return response.redirect().withQs(false).toRoute('home', { locale: i18n.locale })
    }

    session.flash('success', i18n.t('supplier.profile.quoteEmail.verifiedFlash'))
    // Route hors `auth` : la session n'est lue que si on la demande.
    await auth.check()
    const ownsProfile = auth.user?.currentOrganizationId === profile.organizationId
    const route = ownsProfile ? 'supplier.profile' : 'home'
    return response.redirect().withQs(false).toRoute(route, { locale: i18n.locale })
  }
}
