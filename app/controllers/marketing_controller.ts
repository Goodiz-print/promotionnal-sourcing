import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import ContactRequestService from '#services/contact_request_service'
import ProductCatalogueService from '#services/product_catalogue_service'
import CategoryTransformer from '#transformers/category_transformer'
import { SUPPORTED_LOCALES, type Locale } from '#shared/types/i18n'
import { contactRequestValidator } from '#validators/contact'
import { CONTACT_HONEYPOT_FIELD, SITEMAP_PAGES } from '#shared/types/marketing'

const FEATURED_CATEGORIES_LIMIT = 6

/**
 * Pages publiques de la landing (accueil, contact, mentions légales,
 * confidentialité, remerciement). Contenu statique : les textes viennent des
 * fichiers de traduction ; seul le formulaire de contact délègue à un service.
 */
@inject()
export default class MarketingController {
  constructor(
    private catalogue: ProductCatalogueService,
    private contactRequests: ContactRequestService
  ) {}

  /** Accueil : le contenu est statique, hormis les catégories mises en avant. */
  async home({ inertia, i18n }: HttpContext) {
    const categories = await this.catalogue.featuredCategories(FEATURED_CATEGORIES_LIMIT)
    return inertia.render('marketing/home', {
      siteUrl: this.siteUrl(),
      featuredCategories: categories.map((category) =>
        new CategoryTransformer(category, i18n.locale as Locale).toObject()
      ),
    })
  }

  /**
   * `?type=partnership` présélectionne la demande de partenariat (CTA de la
   * landing) ; `partenariat` reste accepté pour les liens de l'ancien site.
   */
  contact({ inertia, request }: HttpContext) {
    const requested = request.input('type')
    return inertia.render('marketing/contact', {
      siteUrl: this.siteUrl(),
      initialType:
        requested === 'partnership' || requested === 'partenariat' ? 'partnership' : 'contact',
    })
  }

  /**
   * Envoi du formulaire de contact. Un champ piège rempli (robot) reçoit la même
   * réponse qu'un envoi réussi, sans rien transmettre. Une erreur de validation
   * revient sur le formulaire avec ses messages (Inertia).
   */
  async sendContact({ request, response, i18n }: HttpContext) {
    const { [CONTACT_HONEYPOT_FIELD]: trap, ...input } =
      await request.validateUsing(contactRequestValidator)

    if (!trap) await this.contactRequests.submit(input, i18n.locale as Locale)

    return response.redirect().toRoute('marketing.thanks', { locale: i18n.locale })
  }

  legal({ inertia }: HttpContext) {
    return inertia.render('marketing/legal', { siteUrl: this.siteUrl() })
  }

  privacy({ inertia }: HttpContext) {
    return inertia.render('marketing/privacy', { siteUrl: this.siteUrl() })
  }

  thanks({ inertia }: HttpContext) {
    return inertia.render('marketing/thanks', { siteUrl: this.siteUrl() })
  }

  /** Origine publique du site, pour les URLs absolues (canonical, hreflang, Open Graph). */
  private siteUrl(): string {
    return new URL(env.get('APP_URL', 'http://localhost:5555')).origin
  }

  /**
   * Sitemap XML : chaque page indexable dans chaque langue, avec ses
   * alternates hreflang.
   */
  sitemap({ response }: HttpContext) {
    const origin = this.siteUrl()
    const url = (locale: string, page: string) => `${origin}/${locale}${page ? `/${page}` : ''}`

    const entries = SITEMAP_PAGES.flatMap((page) =>
      SUPPORTED_LOCALES.map((locale) => {
        const alternates = SUPPORTED_LOCALES.map(
          (alt) => `<xhtml:link rel="alternate" hreflang="${alt}" href="${url(alt, page)}"/>`
        ).join('')
        return `<url><loc>${url(locale, page)}</loc>${alternates}</url>`
      })
    )

    response.header('Content-Type', 'application/xml; charset=utf-8')
    return response.send(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries.join('')}</urlset>`
    )
  }
}
