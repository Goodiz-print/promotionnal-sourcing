import factory from '@adonisjs/lucid/factories'
import stringHelpers from '@adonisjs/core/helpers/string'
import Product from '#models/product'
import { SupplierFactory } from '#database/factories/supplier_factory'
import { CategoryFactory } from '#database/factories/category_factory'

/**
 * Produit de test. `supplierId` et `categoryId` sont obligatoires (NOT NULL) :
 * - `.with('supplier').with('category')` les crée automatiquement,
 * - ou `.merge({ supplierId, categoryId })` pour réutiliser des enregistrements
 *   existants.
 *
 * L'état `retired` simule un produit archivé (lifecycleStatus='retired',
 * isActive=false).
 */
export const ProductFactory = factory
  .define(Product, ({ faker }) => ({
    slug: stringHelpers.slug(`product-${faker.string.alphanumeric(8)}`, { lower: true }),
    sourceLocale: 'fr',
    lifecycleStatus: 'active',
    isActive: true,
    currency: 'EUR',
    madeInEurope: false,
    isEco: false,
    isConfigurable: false,
    printable: false,
    rushService: false,
  }))
  .relation('supplier', () => SupplierFactory)
  .relation('category', () => CategoryFactory)
  .state('retired', (product) => {
    product.lifecycleStatus = 'retired'
    product.isActive = false
  })
  .state('unpublished', (product) => {
    product.isActive = false
  })
  .build()
