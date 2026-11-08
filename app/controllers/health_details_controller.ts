import { createHash, timingSafeEqual } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import healthConfig from '#config/health'
import HealthProbeService from '#services/health_probe_service'

/** Compare deux secrets en temps constant (hachés : longueurs égales). */
const sameSecret = (a: string, b: string) =>
  timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest())

/**
 * Rapport de santé détaillé pour la supervision externe (#179), protégé par le
 * jeton `HEALTH_TOKEN` (`Authorization: Bearer …`). Sans jeton configuré, le point
 * d'entrée n'existe pas (404). Contrôleur à part de `HealthController` : la sonde
 * de liveness `/health` ne doit dépendre d'aucun autre composant, pas même pour
 * résoudre ses dépendances.
 *
 * Répond 503 quand la plateforme est `down` (un composant en panne), 200 sinon :
 * `degraded` se lit dans le corps.
 */
@inject()
export default class HealthDetailsController {
  constructor(private probes: HealthProbeService) {}

  async show({ request, response }: HttpContext) {
    const token = healthConfig.token
    if (!token) return response.notFound()

    const provided = (request.header('authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!sameSecret(provided, token)) return response.unauthorized({ status: 'unauthorized' })

    const report = await this.probes.report()
    return response.status(report.status === 'down' ? 503 : 200).json(report)
  }
}
