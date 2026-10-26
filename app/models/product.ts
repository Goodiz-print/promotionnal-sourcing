import { belongsTo, hasMany, hasOne, manyToMany, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, HasOne, ManyToMany } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import { ProductSchema } from '#database/schema'
import Supplier from '#models/supplier'
import Category from '#models/category'
import AttributeValue from '#models/attribute_value'
import Certification from '#models/certification'
import ProductAttribute from '#models/product_attribute'
import ProductTranslation from '#models/product_translation'
import type { TranslationLocale } from '#shared/types/i18n'
import type { OriginZone, ProductLifecycleStatus } from '#shared/types/product'
import { latestDecisionIsRejectedSql } from '#shared/helpers/moderation'
import ProductImage from '#models/product_image'
import ProductVariant from '#models/product_variant'
import ProductPriceTier from '#models/product_price_tier'
import ProductDocument from '#models/product_document'
import ProductPackaging from '#models/product_packaging'
import ProductMarkingPosition from '#models/product_marking_position'
import ProductMarkingPriceTier from '#models/product_marking_price_tier'

export default class Product extends ProductSchema {
  static table = 'products'

  /** Langue dans laquelle le fournisseur a saisi le contenu (#75). */
  declare sourceLocale: TranslationLocale

  /** Statut « cycle de vie » (écart 5) ; distinct de `isActive` (publication). */
  declare lifecycleStatus: ProductLifecycleStatus

  /**
   * Zone de provenance **dérivée** (écart 9) : `ProductOriginService` la calcule
   * à partir de `originCountry`/`madeInEurope`. Jamais saisie à la main.
   */
  declare originZone: OriginZone | null

  /**
   * Pendant de `Supplier.fromLiveOrganization` : masque les produits dont la
   * fiche fournisseur appartient à une organisation archivée **ou rejetée** (#54).
   */
  static fromLiveOrganization = scope((query: ModelQueryBuilderContract<typeof Product>) => {
    query.whereHas('supplier', (supplier) =>
      supplier.whereDoesntHave('organization', (organization) =>
        organization
          .whereNotNull('archivedAt')
          .orWhereRaw(latestDecisionIsRejectedSql('organization', 'organizations.id'))
      )
    )
  })

  /**
   * Visible du public : la dernière décision de modération n'est pas un rejet.
   * Une cible sans décision (`pending`) reste visible (#54).
   */
  static notRejected = scope((query: ModelQueryBuilderContract<typeof Product>) => {
    query.whereRaw(`NOT ${latestDecisionIsRejectedSql('product', 'products.id')}`)
  })

  @hasMany(() => ProductTranslation)
  declare translations: HasMany<typeof ProductTranslation>

  @hasMany(() => ProductImage)
  declare images: HasMany<typeof ProductImage>

  @hasMany(() => ProductVariant)
  declare variants: HasMany<typeof ProductVariant>

  @hasMany(() => ProductPriceTier)
  declare priceTiers: HasMany<typeof ProductPriceTier>

  @hasMany(() => ProductDocument)
  declare documents: HasMany<typeof ProductDocument>

  /**
   * Conditionnement / logistique (écart 3). Relation 1:1 (au plus une ligne
   * `product_packagings` par produit, `product_id` unique).
   */
  @hasOne(() => ProductPackaging)
  declare packaging: HasOne<typeof ProductPackaging>

  /**
   * Zones de marquage du produit (écart 2), 1..N. Chaque position porte ses
   * techniques possibles (`techniques`) et peut pointer un gabarit.
   */
  @hasMany(() => ProductMarkingPosition)
  declare markingPositions: HasMany<typeof ProductMarkingPosition>

  /** Grille de prix de marquage (écart 2), par technique et quantité. */
  @hasMany(() => ProductMarkingPriceTier)
  declare markingPriceTiers: HasMany<typeof ProductMarkingPriceTier>

  @belongsTo(() => Supplier)
  declare supplier: BelongsTo<typeof Supplier>

  @belongsTo(() => Category)
  declare category: BelongsTo<typeof Category>

  @hasMany(() => ProductAttribute)
  declare productAttributes: HasMany<typeof ProductAttribute>

  @manyToMany(() => AttributeValue, {
    pivotTable: 'product_attributes',
    pivotColumns: ['attribute_id', 'value_number', 'value_string'],
    pivotTimestamps: false,
  })
  declare attributeValues: ManyToMany<typeof AttributeValue>

  /**
   * Labels de conformité portés par le produit (écart 4), via le pivot
   * `product_certifications`. Alimentent entre autres la dérivation `is_eco`.
   */
  @manyToMany(() => Certification, {
    pivotTable: 'product_certifications',
    pivotTimestamps: false,
  })
  declare certifications: ManyToMany<typeof Certification>
}
