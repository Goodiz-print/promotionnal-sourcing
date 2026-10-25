import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { QuoteItemSchema } from '#database/schema'
import Product from '#models/product'
import Quote from '#models/quote'
import RfqItem from '#models/rfq_item'
import type { QuoteCustomizationDetails } from '#shared/types/quote'

/**
 * Ligne d'un devis, en face d'un item de la demande. Montants en `numeric`
 * (chaînes côté Lucid) : le calcul se fait dans `QuoteService`, jamais ici.
 */
export default class QuoteItem extends QuoteItemSchema {
  static table = 'quote_items'

  /**
   * Redéclarée avec son décorateur pour la même raison que `RfqItem.specs` :
   * `jsonb` est rendu en objet par Postgres, en texte par SQLite.
   */
  @column({
    prepare: (value: QuoteCustomizationDetails | null) => (value ? JSON.stringify(value) : null),
    consume: (value: unknown): QuoteCustomizationDetails | null => {
      if (value === null || value === undefined) return null
      return typeof value === 'string'
        ? (JSON.parse(value) as QuoteCustomizationDetails)
        : (value as QuoteCustomizationDetails)
    },
  })
  declare customizationDetails: QuoteCustomizationDetails | null

  @belongsTo(() => Quote)
  declare quote: BelongsTo<typeof Quote>

  @belongsTo(() => RfqItem)
  declare rfqItem: BelongsTo<typeof RfqItem>

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>
}
