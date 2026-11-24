import { belongsTo, hasMany, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { SupplierSchema } from '#database/schema'
import { latestDecisionIsRejectedSql } from '#shared/helpers/moderation'
import Organization from '#models/organization'
import Product from '#models/product'
import SupplierTranslation from '#models/supplier_translation'
import User from '#models/user'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

export default class Supplier extends SupplierSchema {
  static table = 'suppliers'

  /**
   * Fiches **publiées** : rattachées à une organisation ni archivée ni rejetée
   * par la modération. Une fiche **sans** organisation (`organization_id` NULL :
   * import en masse en attente de l'accord du fournisseur) n'est pas publiée
   * (#240) : elle reste en base et dans le back-office, jusqu'à son
   * rattachement (#231).
   */
  static fromLiveOrganization = scope((query: ModelQueryBuilderContract<typeof Supplier>) => {
    query.whereHas('organization', (organization) =>
      organization
        .whereNull('archivedAt')
        .whereRaw(`NOT ${latestDecisionIsRejectedSql('organization', 'organizations.id')}`)
    )
  })

  @hasMany(() => SupplierTranslation)
  declare translations: HasMany<typeof SupplierTranslation>

  @hasMany(() => Product)
  declare products: HasMany<typeof Product>

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>

  /** Admin qui a validé le rattachement à l'organisation (#231). */
  @belongsTo(() => User, { foreignKey: 'linkedByUserId' })
  declare linkedBy: BelongsTo<typeof User>
}
