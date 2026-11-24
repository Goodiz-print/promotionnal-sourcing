import { BaseSchema } from '@adonisjs/lucid/schema'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import { createIndexConcurrently } from '#database/concurrent_index'
import { dropIndexConcurrentlySql } from '#shared/helpers/database'

const TABLE = 'activity_events'
const TARGET_PERIOD_INDEX = 'activity_events_target_type_target_id_created_at_index'
const TARGET_INDEX = 'activity_events_target_type_target_id_index'

/**
 * Consultations d'un fournisseur (#239) : les compteurs partent des produits et
 * de la fiche du fournisseur (`target_type`, `target_id`) sur une période
 * (`created_at`). Sans cet index, une période d'un an parcourt par
 * `created_at` les événements de toute la plateforme à chaque affichage.
 * L'index `(target_type, target_id)` devient un préfixe du nouveau : il est
 * remplacé.
 *
 * `activity_events` reçoit en continu les écritures de la queue : les index
 * sont construits et retirés `CONCURRENTLY` (`createIndexConcurrently`), hors
 * transaction, sans bloquer ces écritures. Après un échec, la migration se
 * relance telle quelle.
 */
export default class extends BaseSchema {
  static disableTransactions = true

  async up() {
    this.defer(async (db) => {
      await createIndexConcurrently(db, {
        name: TARGET_PERIOD_INDEX,
        table: TABLE,
        columns: 'target_type, target_id, created_at',
      })
      await dropIndex(db, TARGET_INDEX)
    })
  }

  async down() {
    this.defer(async (db) => {
      await createIndexConcurrently(db, {
        name: TARGET_INDEX,
        table: TABLE,
        columns: 'target_type, target_id',
      })
      await dropIndex(db, TARGET_PERIOD_INDEX)
    })
  }
}

/** Étape de migration à effet (requête), pas un calcul : elle reste ici. */
async function dropIndex(db: QueryClientContract, name: string): Promise<void> {
  await db.rawQuery(dropIndexConcurrentlySql(name))
}
