import { hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import { CertificationSchema } from '#database/schema'
import CertificationTranslation from '#models/certification_translation'
import Product from '#models/product'
import type { CertificationDomain } from '#shared/types/certification'

/**
 * Label de conformité (écart 4) : référentiel fermé (~29 labels). Mêmes
 * colonnes neutres que les attributs ; le libellé affichable est porté par
 * `translations`. Rattaché aux produits via le pivot `product_certifications`.
 */
export default class Certification extends CertificationSchema {
  static table = 'certifications'

  declare domain: CertificationDomain
  declare synonyms: string[]

  @hasMany(() => CertificationTranslation)
  declare translations: HasMany<typeof CertificationTranslation>

  @manyToMany(() => Product, {
    pivotTable: 'product_certifications',
    pivotTimestamps: false,
  })
  declare products: ManyToMany<typeof Product>
}
