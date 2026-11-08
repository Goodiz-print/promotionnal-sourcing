import router from '@adonisjs/core/services/router'
import { healthDetailsThrottle } from '#start/limiter'
import { controllers } from '#generated/controllers'

/**
 * Sonde de santé du process web. Hors préfixe de locale et sans authentification :
 * elle doit répondre à l'équilibreur de charge et au healthcheck du conteneur.
 */
export function registerHealthRoutes(): void {
  router.get('health', [controllers.Health, 'show']).as('health.show')
  // Rapport détaillé pour la supervision externe (#179) : protégé par `HEALTH_TOKEN`.
  router
    .get('health/details', [controllers.HealthDetails, 'show'])
    .as('health.details')
    .use(healthDetailsThrottle)
}
