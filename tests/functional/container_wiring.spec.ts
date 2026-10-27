import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import ProductsController from '#controllers/products_controller'
import SuppliersController from '#controllers/suppliers_controller'
import OnboardingController from '#controllers/onboarding_controller'
import CategoryController from '#controllers/admin/category_controller'
import SupplierProfileController from '#controllers/supplier/profile_controller'
import SupplierProductController from '#controllers/supplier/product_controller'
import ProductSearchService from '#services/product_search_service'
import SearchEngine from '#services/search/search_engine'
import NullSearchEngine from '#services/search/null_search_engine'
import SupplierProductService from '#services/supplier_product_service'
import StorageDriver from '#services/storage/storage_driver'
import CellarStorageDriver from '#services/storage/cellar_storage_driver'
import StorageService from '#services/storage/storage_service'
import StorageCleanupService from '#services/storage/storage_cleanup_service'

/**
 * Garde-fou d'injection de dépendances : le conteneur IoC doit savoir résoudre
 * les controllers (avec leurs services injectés) et les abstractions liées par
 * des service providers (`SearchEngine`, `StorageDriver`…).
 * Ne touche pas la base.
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
    assert.instanceOf(await app.container.make(ProductSearchService), ProductSearchService)
    assert.instanceOf(await app.container.make(SupplierProductService), SupplierProductService)
  })

  test('lie SearchEngine au moteur inerte sans ELASTICSEARCH_URL', async ({ assert }) => {
    const engine = await app.container.make(SearchEngine)
    assert.instanceOf(engine, NullSearchEngine)
    assert.isFalse(engine.enabled)
  })

  test('lie StorageDriver à Cellar et résout les services de stockage', async ({ assert }) => {
    assert.instanceOf(await app.container.make(StorageDriver), CellarStorageDriver)
    assert.instanceOf(await app.container.make(StorageService), StorageService)
    assert.instanceOf(await app.container.make(StorageCleanupService), StorageCleanupService)
  })
})
