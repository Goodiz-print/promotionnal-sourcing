import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import AdClickService from '#services/ad_click_service'
import { adClickValidator } from '#validators/ads'
import { AD_CLICK_SIGNATURE_PURPOSE, AD_MIN_CPC_CENTS } from '#shared/types/ads'

/**
 * Cible du lien d'un produit sponsorisé : enregistre (et facture) le clic, puis
 * redirige vers la fiche. Public. Un lien altéré ou expiré redirige quand même,
 * sans rien facturer — le visiteur n'est jamais bloqué.
 */
@inject()
export default class AdClicksController {
  constructor(private clicks: AdClickService) {}

  async show({ request, response, params, auth, i18n }: HttpContext) {
    const [, query] = await adClickValidator.tryValidate(request.qs())
    const signed = query !== null && request.hasValidSignature(AD_CLICK_SIGNATURE_PURPOSE)

    const slug = await this.clicks.register({
      campaignId: Number(params.id),
      signed,
      placement: query?.p ?? 'catalogue',
      costCents: query?.c ?? AD_MIN_CPC_CENTS,
      // Route publique : l'utilisateur n'est connu que s'il a une session.
      user: (await auth.check()) ? auth.user! : null,
      ip: request.ip(),
      userAgent: request.header('user-agent') ?? null,
    })

    if (!slug) {
      return response.redirect().withQs(false).toRoute('products.index', { locale: i18n.locale })
    }
    return response.redirect().withQs(false).toRoute('products.show', { locale: i18n.locale, slug })
  }
}
