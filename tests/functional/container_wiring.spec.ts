import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import ProductsController from '#controllers/products_controller'
import SuppliersController from '#controllers/suppliers_controller'
import OnboardingController from '#controllers/onboarding_controller'
import CategoryController from '#controllers/admin/category_controller'
import SupplierProfileController from '#controllers/supplier/profile_controller'
import SupplierProductController from '#controllers/supplier/product_controller'
import EmbeddingService from '#services/embedding_service'
import SupplierProductService from '#services/supplier_product_service'
import EmbeddingProvider from '#services/embeddings/embedding_provider'
import MistralEmbeddingProvider from '#services/embeddings/mistral_provider'

/**
 * Garde-fou d'injection de dépendances : le conteneur IoC doit savoir résoudre
 * les controllers (avec leurs services injectés) et l'abstraction `AI_PROVIDER`.
 * Ne touche pas la DB → tourne sous SQLite.
 */
test.group('Conteneur IoC — câblage des dépendances', () => {
  test('résout les controllers avec leurs services injectés', async ({ assert }) => {
    assert.instanceOf(await app.container.make(ProductsController), ProductsController)
    assert.instanceOf(await app.container.make(SuppliersController), SuppliersController)
    assert.instanceOf(await app.container.make(OnboardingController), OnboardingController)
    assert.instanceOf(await app.container.make(CategoryController), CategoryController)
    assert.instanceOf(
      await app.container.make(SupplierProfileController),
      SupplierProfileController
    )
    assert.instanceOf(
      await app.container.make(SupplierProductController),
      SupplierProductController
    )
  })

  test('résout les services injectables', async ({ assert }) => {
    assert.instanceOf(await app.container.make(EmbeddingService), EmbeddingService)
    assert.instanceOf(await app.container.make(SupplierProductService), SupplierProductService)
  })

  test('lie EmbeddingProvider au driver configuré (défaut : mistral)', async ({ assert }) => {
    const provider = await app.container.make(EmbeddingProvider)
    assert.instanceOf(provider, MistralEmbeddingProvider)
    assert.equal(provider.name, 'mistral')
  })
})
