import factory from '@adonisjs/lucid/factories'
import stringHelpers from '@adonisjs/core/helpers/string'
import Category from '#models/category'
import type { TranslationLocale } from '#shared/types/i18n'

/**
 * Catégorie de test. `parentId` est nullable : ne pas le fournir crée une
 * catégorie racine. Pour tester le filtre `categoryId` avec sous-catégories,
 * créer d'abord une catégorie parente, puis une enfant via
 * `.merge({ parentId: parent.id })`.
 */
export const CategoryFactory = factory
  .define(Category, ({ faker }) => ({
    slug: stringHelpers.slug(`cat-${faker.string.alphanumeric(8)}`, { lower: true }),
    sourceLocale: 'fr' as TranslationLocale,
    synonyms: [],
  }))
  .build()
