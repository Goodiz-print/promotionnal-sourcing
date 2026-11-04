import factory from '@adonisjs/lucid/factories'
import ProductTranslation from '#models/product_translation'
import type { ContentLocale } from '#shared/types/i18n'

/**
 * Traduction produit de test. `productId` et `locale` sont à fournir par
 * l'appelant via `.merge({ productId, locale })`. Attention à l'unicité
 * (product_id, locale) : ne créer qu'une seule traduction par locale et
 * par produit.
 */
export const ProductTranslationFactory = factory
  .define(ProductTranslation, ({ faker }) => ({
    name: faker.commerce.productName(),
    locale: 'fr' as ContentLocale,
    isAuto: false,
  }))
  .build()
