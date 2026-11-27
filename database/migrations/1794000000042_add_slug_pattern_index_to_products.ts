import { BaseSchema } from '@adonisjs/lucid/schema'
import { createIndexConcurrently } from '#database/concurrent_index'
import { dropIndexConcurrentlySql } from '#shared/helpers/database'

const SLUG_PATTERN_INDEX = 'products_slug_pattern_index'

/**
 * Slug unique en une requête (#248) : l'import lit `slug = base OR slug LIKE
 * 'base-%'`. L'index unique de `slug` suit la collation de la base (non C en
 * production) et ne sert pas un `LIKE` par préfixe : sans cet index
 * `varchar_pattern_ops`, chaque fiche créée parcourrait toute la table.
 *
 * `products` reçoit les écritures des imports et du back-office : l'index est
 * construit et retiré `CONCURRENTLY`, hors transaction. Après un échec, la
 * migration se relance telle quelle.
 */
export default class extends BaseSchema {
  static disableTransactions = true

  async up() {
    this.defer(async (db) => {
      await createIndexConcurrently(db, {
        name: SLUG_PATTERN_INDEX,
        table: 'products',
        columns: 'slug varchar_pattern_ops',
      })
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(dropIndexConcurrentlySql(SLUG_PATTERN_INDEX))
    })
  }
}
