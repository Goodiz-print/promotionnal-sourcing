import Product from '#models/product'
import Category from '#models/category'
import Attribute from '#models/attribute'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import { DEFAULT_TSCONFIG, LOCALE_TSCONFIG, type Locale } from '#shared/types/i18n'
import { toPgVector } from '#shared/helpers/pgvector'
import type { ProductDirectoryFilters } from '#shared/types/product'

interface ListOptions extends ProductDirectoryFilters {
  page: number
  perPage: number
  locale: Locale
  // Embedding de la requête (recherche sémantique). Fourni par le controller
  // quand la recherche IA est active ; sinon repli sur le full-text.
  queryEmbedding?: number[] | null
}

/**
 * Catalogue public des produits. Toute la logique ORM vit ici (controllers
 * fins). Ne renvoie que les produits actifs, et jamais ceux d'une
 * organisation archivée.
 */
export default class ProductCatalogueService {
  /**
   * Liste paginée + filtrable :
   * - recherche full-text locale-aware sur `product_translations.search_vector`
   *   (`websearch_to_tsquery` : accepte du texte libre utilisateur) ;
   * - filtre catégorie et made-in-Europe ;
   * - facettes attributs en **ET fiable** (un `whereHas` par valeur → chaque
   *   contrainte est combinée en `AND`, cf. `docs/catalogue.md`).
   */
  list(options: ListOptions): Promise<ModelPaginatorContract<Product>> {
    const { page, perPage, locale, search, categoryId, madeInEurope, attributeValueIds } = options
    const queryEmbedding = options.queryEmbedding

    // `tsConfig` provient d'une table contrôlée (jamais d'entrée utilisateur),
    // donc interpolable sans risque ; seul le terme recherché est bindé.
    const tsConfig = LOCALE_TSCONFIG[locale] ?? DEFAULT_TSCONFIG

    const query = Product.query()
      .where('isActive', true)
      .withScopes((scopes) => scopes.fromLiveOrganization())
      .if(categoryId, (q) => q.where('categoryId', categoryId!))
      .if(madeInEurope, (q) => q.where('madeInEurope', true))
      .if(attributeValueIds.length > 0, (q) => {
        for (const valueId of attributeValueIds) {
          q.whereHas('attributeValues', (av) => av.where('attribute_values.id', valueId))
        }
      })
      .preload('translations')

    if (search && queryEmbedding && queryEmbedding.length > 0) {
      // Recherche sémantique : plus proches voisins (distance cosinus pgvector,
      // index HNSW `products_embedding_idx`) parmi les produits vectorisés.
      query
        .whereNotNull('embedding')
        .orderByRaw('embedding <=> ?::vector', [toPgVector(queryEmbedding)])
    } else if (search) {
      // Repli full-text locale-aware (IA indisponible ou requête non vectorisée).
      query
        .whereHas('translations', (t) =>
          t
            .where('locale', locale)
            .whereRaw(`search_vector @@ websearch_to_tsquery('${tsConfig}', ?)`, [search])
        )
        .orderBy('slug')
    } else {
      query.orderBy('slug')
    }

    return query.paginate(page, perPage)
  }

  /**
   * Fiche produit par slug : traductions + fournisseur, catégorie et facettes
   * (attribut + valeur) préchargés/localisés. `null` si introuvable/inactif.
   */
  findBySlug(slug: string): Promise<Product | null> {
    return Product.query()
      .where('slug', slug)
      .where('isActive', true)
      .withScopes((scopes) => scopes.fromLiveOrganization())
      .preload('translations')
      .preload('images', (images) => images.orderBy('position'))
      .preload('supplier', (supplier) => supplier.preload('translations'))
      .preload('category', (category) => category.preload('translations'))
      .preload('productAttributes', (pa) =>
        pa
          .preload('attribute', (attribute) => attribute.preload('translations'))
          .preload('attributeValue', (value) => value.preload('translations'))
      )
      .first()
  }

  /**
   * Catégories ayant au moins un produit actif (pour le filtre catégorie).
   */
  availableCategories(): Promise<Category[]> {
    return Category.query()
      .whereHas('products', (products) =>
        products
          .where('isActive', true)
          .whereHas('supplier', (supplier) =>
            supplier.whereDoesntHave('organization', (organization) =>
              organization.whereNotNull('archivedAt')
            )
          )
      )
      .preload('translations')
      .orderBy('slug')
  }

  /**
   * Attributs filtrables avec leurs valeurs (pour la barre de facettes).
   */
  filterableAttributes(): Promise<Attribute[]> {
    return Attribute.query()
      .where('isFilterable', true)
      .preload('translations')
      .preload('values', (values) => values.preload('translations').orderBy('slug'))
      .orderBy('slug')
  }
}
