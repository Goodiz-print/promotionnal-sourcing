import { DateTime } from 'luxon'
import { ActivityEventFactory } from '#database/factories/activity_event_factory'
import { CategoryFactory } from '#database/factories/category_factory'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { ProductFactory } from '#database/factories/product_factory'
import { ProductTranslationFactory } from '#database/factories/product_translation_factory'
import { SupplierFactory } from '#database/factories/supplier_factory'
import { createMember } from '#tests/utils/organizations'
import type Organization from '#models/organization'
import type Product from '#models/product'
import type Supplier from '#models/supplier'
import type User from '#models/user'
import type { ActivityEventTargetType, ActivityEventType } from '#shared/types/activity_event'

/** Organisation fournisseuse, son owner, sa fiche et ses produits nommés en français. */
export interface SupplierWithProducts {
  organization: Organization
  owner: User
  supplier: Supplier
  products: Product[]
}

/**
 * Scénario de base des specs « Consultations » (#239) : un fournisseur et ses
 * produits, chacun avec une traduction française au nom donné.
 */
export async function createSupplierWithProducts(names: string[]): Promise<SupplierWithProducts> {
  const organization = await OrganizationFactory.apply('supplier').create()
  const owner = await createMember(organization, 'owner')
  const supplier = await SupplierFactory.merge({ organizationId: organization.id }).create()
  const category = await CategoryFactory.create()
  const products = await Promise.all(
    names.map(async (name) => {
      const product = await ProductFactory.merge({
        supplierId: supplier.id,
        categoryId: category.id,
      }).create()
      await ProductTranslationFactory.merge({ productId: product.id, locale: 'fr', name }).create()
      return product
    })
  )
  return { organization, owner, supplier, products }
}

/** Un événement à écrire : vue produit par défaut, d'aujourd'hui, anonyme. */
export interface ViewInput {
  targetId: number
  type?: ActivityEventType
  targetType?: ActivityEventTargetType
  organizationId?: number | null
  daysAgo?: number
  times?: number
}

/** Écrit `times` événements identiques (consultation d'un produit par défaut). */
export function recordViews(input: ViewInput) {
  const type = input.type ?? 'product_viewed'
  return ActivityEventFactory.merge({
    type,
    targetType: input.targetType ?? (type === 'supplier_viewed' ? 'supplier' : 'product'),
    targetId: input.targetId,
    organizationId: input.organizationId ?? null,
    createdAt: DateTime.now().minus({ days: input.daysAgo ?? 0 }),
  }).createMany(input.times ?? 1)
}
