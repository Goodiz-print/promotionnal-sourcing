import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

/**
 * Messagerie acheteur ↔ fournisseur (#167). Appelé depuis `start/routes.ts`,
 * **à l'intérieur** du groupe préfixé par la locale et gardé par `auth` +
 * `onboarded`. Seul le signalement est exposé : l'écran de conversation viendra
 * s'y brancher.
 */
export function registerMessagingRoutes(): void {
  router
    .post('messages/:id/report', [controllers.MessageReport, 'store'])
    .where('id', router.matchers.number())
    .as('messages.report')
}
