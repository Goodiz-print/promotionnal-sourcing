import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { contactRequestThrottle } from '#start/limiter'

/**
 * Pages publiques de la landing. Appelé depuis `start/routes.ts`, **à
 * l'intérieur** du groupe préfixé par la locale ; aucune authentification.
 */
export function registerMarketingRoutes(): void {
  router.get('contact', [controllers.Marketing, 'contact']).as('marketing.contact')
  router
    .post('contact', [controllers.Marketing, 'sendContact'])
    .as('marketing.contact.store')
    .use(contactRequestThrottle)
  router.get('legal', [controllers.Marketing, 'legal']).as('marketing.legal')
  router.get('privacy', [controllers.Marketing, 'privacy']).as('marketing.privacy')
  router.get('thanks', [controllers.Marketing, 'thanks']).as('marketing.thanks')
}

/**
 * Hors préfixe de locale : sitemap, et redirections 301 des anciennes URLs du
 * site Astro (slugs traduits) vers les URLs `/:locale/<slug>` de l'application.
 */
export function registerMarketingLegacyRoutes(): void {
  router.get('sitemap.xml', [controllers.Marketing, 'sitemap']).as('marketing.sitemap')

  const legacy: Record<string, string> = {
    '/contact': '/fr/contact',
    '/mentions-legales': '/fr/legal',
    '/politique-de-confidentialite': '/fr/privacy',
    '/merci': '/fr/thanks',
    '/en/legal-notice': '/en/legal',
    '/en/privacy-policy': '/en/privacy',
    '/en/thank-you': '/en/thanks',
  }

  for (const [from, to] of Object.entries(legacy)) {
    router.get(from, ({ response }) => response.redirect().status(301).toPath(to))
  }
}
