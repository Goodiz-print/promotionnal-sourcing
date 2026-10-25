import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

/**
 * Notifications in-app (#57). Appelé depuis `start/routes.ts`, **à l'intérieur**
 * du groupe préfixé par la locale et gardé par `auth` + `onboarded`.
 */
export function registerNotificationRoutes(): void {
  router.get('notifications', [controllers.Notifications, 'index']).as('notifications.index')
  router
    .patch('notifications/:id/read', [controllers.Notifications, 'read'])
    .as('notifications.read')
  router
    .post('notifications/read-all', [controllers.Notifications, 'readAll'])
    .as('notifications.readAll')
}
