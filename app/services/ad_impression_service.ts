import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import type { AdPlacement } from '#shared/types/ads'

/**
 * Compteurs d'affichages des produits sponsorisés : un seul `INSERT … ON
 * CONFLICT` par écran servi, qui incrémente le compteur du jour. **N'échoue
 * jamais** : un compteur manqué ne doit pas faire tomber une page publique.
 */
export default class AdImpressionService {
  async record(campaignIds: number[], placement: AdPlacement): Promise<void> {
    if (campaignIds.length === 0) return
    const day = DateTime.now().toISODate()!

    try {
      await db.rawQuery(
        `INSERT INTO ad_impressions (campaign_id, day, placement, count)
         VALUES ${campaignIds.map(() => '(?, ?, ?, 1)').join(', ')}
         ON CONFLICT (campaign_id, day, placement)
         DO UPDATE SET count = ad_impressions.count + 1`,
        campaignIds.flatMap((id) => [id, day, placement])
      )
    } catch (error) {
      logger.warn({ err: error }, 'ad impressions could not be recorded')
    }
  }
}
