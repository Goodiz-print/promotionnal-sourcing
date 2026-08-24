import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { RfqItemSchema } from '#database/schema'
import Category from '#models/category'
import Product from '#models/product'
import Rfq from '#models/rfq'
import type { RfqItemSpecs } from '#shared/types/rfq'

export default class RfqItem extends RfqItemSchema {
  static table = 'rfq_items'

  /**
   * Seule colonne du projet redéclarée avec son décorateur : `jsonb` est rendu
   * en objet par le driver Postgres mais en texte par SQLite (connexion de
   * repli du projet). La (dé)sérialisation explicite rend l'item identique sur
   * les deux, et remplace le `any` du schéma généré par un type utile.
   */
  @column({
    prepare: (value: RfqItemSpecs | null) => (value ? JSON.stringify(value) : null),
    consume: (value: unknown): RfqItemSpecs | null => {
      if (value === null || value === undefined) return null
      return typeof value === 'string'
        ? (JSON.parse(value) as RfqItemSpecs)
        : (value as RfqItemSpecs)
    },
  })
  declare specs: RfqItemSpecs | null

  @belongsTo(() => Rfq)
  declare rfq: BelongsTo<typeof Rfq>

  @belongsTo(() => Category)
  declare category: BelongsTo<typeof Category>

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>
}
