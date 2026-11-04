import factory from '@adonisjs/lucid/factories'
import stringHelpers from '@adonisjs/core/helpers/string'
import Supplier from '#models/supplier'

/**
 * Fiche fournisseur de test. `organizationId` est nullable : ne pas le fournir
 * crée un fournisseur sans organisation rattachée. Pour tester le filtre
 * `supplierId` (qui filtre par `organization_id`), passer
 * `.merge({ organizationId: org.id })`.
 */
export const SupplierFactory = factory
  .define(Supplier, ({ faker }) => ({
    slug: stringHelpers.slug(`supplier-${faker.string.alphanumeric(8)}`, { lower: true }),
    country: 'FR',
    isActive: true,
  }))
  .build()
