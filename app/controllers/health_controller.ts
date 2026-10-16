import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import HealthService from '#services/health_service'

/**
 * Sonde HTTP pour l'équilibreur de charge et le healthcheck du conteneur web.
 * Ne vérifie que la base : un backlog de queue ne doit pas redémarrer le web
 * (c'est le rôle de `node ace queue:health`).
 */
@inject()
export default class HealthController {
  constructor(private health: HealthService) {}

  async show({ response }: HttpContext) {
    const database = await this.health.databaseReachable()
    return response.status(database ? 200 : 503).json({ status: database ? 'ok' : 'down' })
  }
}
