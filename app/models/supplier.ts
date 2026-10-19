import { belongsTo, hasMany, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { SupplierSchema } from '#database/schema'
import { latestDecisionIsRejectedSql } from '#shared/helpers/moderation'
import Organization from '#models/organization'
import Product from '#models/product'
import SupplierTranslation from '#models/supplier_translation'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

export default class Supplier extends SupplierSchema {
  static table = 'suppliers'

  /**
   * Exclut les fiches rattachées à une organisation **archivée** — le catalogue
   * public ne doit plus les montrer. Les fiches **sans** organisation
   * (`organization_id` NULL : import en masse non encore rattaché) restent
   * visibles, d'où `whereDoesntHave` plutôt qu'une jointure.
   */
  static fromLiveOrganization = scope((query: ModelQueryBuilderContract<typeof Supplier>) => {
    query.whereDoesntHave('organization', (organization) =>
      organization
        .whereNotNull('archivedAt')
        .orWhereRaw(latestDecisionIsRejectedSql('organization', 'organizations.id'))
    )
  })

  @hasMany(() => SupplierTranslation)
  declare translations: HasMany<typeof SupplierTranslation>

  @hasMany(() => Product)
  declare products: HasMany<typeof Product>

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>
}
