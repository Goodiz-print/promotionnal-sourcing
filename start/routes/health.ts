import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

/**
 * Sonde de santé du process web. Hors préfixe de locale et sans authentification :
 * elle doit répondre à l'équilibreur de charge et au healthcheck du conteneur.
 */
export function registerHealthRoutes(): void {
  router.get('health', [controllers.Health, 'show']).as('health.show')
}
