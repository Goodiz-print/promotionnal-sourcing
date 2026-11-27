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
import Anthropic from '@anthropic-ai/sdk'
import aiConfig from '#config/ai'
import { IMAGE_DESCRIPTION_DRIVERS, TRANSLATION_DRIVERS } from '#providers/ai_provider'
import TranslationProvider from '#services/translation/translation_provider'
import MistralTranslationProvider from '#services/translation/mistral_translation_provider'
import ClaudeTranslationProvider from '#services/translation/claude_translation_provider'
import ImageDescriptionProvider from '#services/vision/image_description_provider'
import MistralImageDescriptionProvider from '#services/vision/mistral_image_description_provider'
import ClaudeImageDescriptionProvider from '#services/vision/claude_image_description_provider'
import HealthProbeService from '#services/health_probe_service'
import { LLM_PROVIDERS } from '#shared/types/ai'

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

  test('lie SearchEngine au moteur inerte sans MEILISEARCH_HOST', async ({ assert }) => {
    const engine = await app.container.make(SearchEngine)
    assert.instanceOf(engine, NullSearchEngine)
    assert.isFalse(engine.enabled)
  })

  test('lie StorageDriver à Cellar et résout les services de stockage', async ({ assert }) => {
    assert.instanceOf(await app.container.make(StorageDriver), CellarStorageDriver)
    assert.instanceOf(await app.container.make(StorageService), StorageService)
    assert.instanceOf(await app.container.make(StorageCleanupService), StorageCleanupService)
  })

  test('sans AI_LLM_PROVIDER, traduction et vision sont liées à Mistral', async ({ assert }) => {
    assert.equal(aiConfig.provider, 'mistral')
    assert.equal(aiConfig.translation.model, 'mistral-small-latest')
    assert.instanceOf(await app.container.make(TranslationProvider), MistralTranslationProvider)
    assert.instanceOf(
      await app.container.make(ImageDescriptionProvider),
      MistralImageDescriptionProvider
    )
  })

  test('chaque fournisseur a son driver de traduction et de vision', ({ assert }) => {
    assert.sameMembers(Object.keys(TRANSLATION_DRIVERS), [...LLM_PROVIDERS])
    assert.sameMembers(Object.keys(IMAGE_DESCRIPTION_DRIVERS), [...LLM_PROVIDERS])
    assert.strictEqual(TRANSLATION_DRIVERS.claude, ClaudeTranslationProvider)
    assert.strictEqual(IMAGE_DESCRIPTION_DRIVERS.claude, ClaudeImageDescriptionProvider)
  })

  test('résout les drivers Claude avec le client Anthropic, même sans clé', async ({ assert }) => {
    assert.instanceOf(await app.container.make(Anthropic), Anthropic)
    assert.instanceOf(
      await app.container.make(ClaudeTranslationProvider),
      ClaudeTranslationProvider
    )
    assert.instanceOf(
      await app.container.make(ClaudeImageDescriptionProvider),
      ClaudeImageDescriptionProvider
    )
    assert.instanceOf(await app.container.make(HealthProbeService), HealthProbeService)
  })
})
