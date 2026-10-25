import Product from '#models/product'
import Category from '#models/category'
import Attribute from '#models/attribute'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import { contentLocaleFor, LOCALE_TSCONFIG, type Locale } from '#shared/types/i18n'
import { toPgVector } from '#shared/helpers/pgvector'
import type { ProductDirectoryFilters, ProductSort } from '#shared/types/product'

interface ListOptions extends ProductDirectoryFilters {
  page: number
  perPage: number
  locale: Locale
  // Embedding de la requête (recherche sémantique). Fourni par le controller
  // quand la recherche IA est active ; sinon repli sur le full-text.
  queryEmbedding?: number[] | null
  // `price_asc` : tri par prix unitaire du premier palier (hors recherche
  // sémantique, qui garde son ordre de pertinence).
  sort?: ProductSort | null
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
    // La recherche porte sur la langue de contenu servie pour cette langue d'interface
    // (les langues d'UI sans contenu dédié lisent les fiches anglaises).
    const searchLocale = contentLocaleFor(locale)
    const tsConfig = LOCALE_TSCONFIG[searchLocale]

    const query = Product.query()
      .where('isActive', true)
      .withScopes((scopes) => {
        scopes.fromLiveOrganization()
        scopes.notRejected()
      })
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
        .orderByRaw('embedding <=> ?::halfvec', [toPgVector(queryEmbedding)])
    } else if (search) {
      // Repli full-text locale-aware (IA indisponible ou requête non vectorisée).
      query
        .whereHas('translations', (t) =>
          t
            .where('locale', searchLocale)
            .whereRaw(`search_vector @@ websearch_to_tsquery('${tsConfig}', ?)`, [search])
        )
        .orderBy('slug')
    } else if (options.sort === 'price_asc') {
      // Premier palier = plus petite quantité ; produits sans palier en fin de liste.
      query
        .orderByRaw(
          `(SELECT unit_price FROM product_price_tiers t WHERE t.product_id = products.id ORDER BY t.min_quantity, t.unit_price LIMIT 1) ASC NULLS LAST`
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
      .withScopes((scopes) => {
        scopes.fromLiveOrganization()
        scopes.notRejected()
      })
      .preload('translations')
      .preload('images', (images) => images.orderBy('position').preload('variants'))
      .preload('variants', (variants) =>
        variants
          .where('isActive', true)
          .orderBy('id')
          .preload('attributes', (pivot) =>
            pivot
              .preload('attribute', (attribute) => attribute.preload('translations'))
              .preload('attributeValue', (value) => value.preload('translations'))
          )
      )
      .preload('priceTiers', (tiers) => tiers.orderBy('minQuantity'))
      .preload('documents', (documents) =>
        documents.whereNotNull('storageObjectId').preload('storageObject').orderBy('id')
      )
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
   * Produit visible du catalogue, par identifiant — pour pré-remplir une ligne
   * de demande de devis. Mêmes règles de visibilité que la fiche publique : un
   * produit inactif, rejeté ou d'une organisation archivée n'est pas
   * demandable.
   */
  findForRfq(id: number): Promise<Product | null> {
    return this.visibleForRfq()
      .where('products.id', id)
      .preload('translations')
      .preload('supplier', (supplier) => supplier.preload('organization'))
      .first()
  }

  /**
   * Recherche légère pour le sélecteur de produit d'une demande de devis.
   *
   * Repli PostgreSQL de `ProductSearchService#lookup` (#112) : utilisé quand
   * Meilisearch est inerte ou injoignable. Préfixe/sous-chaîne (`ILIKE`) sur le
   * nom, plus le full-text locale-aware du catalogue ; supprimé avec la PR 3 de
   * #112. Contrat : « produits visibles uniquement, `limit` résultats, nom
   * localisé » — cf. `docs/rfq.md`.
   */
  async lookupForRfq(search: string, locale: Locale, limit: number): Promise<Product[]> {
    const searchLocale = contentLocaleFor(locale)
    // `tsConfig` vient d'une table fermée (`LOCALE_TSCONFIG`), jamais d'une
    // entrée utilisateur : interpolable, comme dans `list()`. Seul le terme est bindé.
    const tsConfig = LOCALE_TSCONFIG[searchLocale]
    // `%` et `_` sont des jokers `LIKE` : la saisie est cherchée telle quelle.
    const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`

    // Le nom est cherché dans **toutes** les langues de contenu : un produit
    // saisi dans une seule langue reste trouvable depuis une autre interface,
    // et le transformer affiche de toute façon son repli. Le full-text, lui,
    // reste propre à la langue de l'interface.
    return await this.visibleForRfq()
      .whereHas('translations', (t) =>
        t
          .whereILike('name', pattern)
          .orWhere((fts) =>
            fts
              .where('locale', searchLocale)
              .whereRaw(`search_vector @@ websearch_to_tsquery('${tsConfig}', ?)`, [search])
          )
      )
      .preload('translations')
      .preload('supplier', (supplier) => supplier.preload('organization'))
      .orderBy('slug')
      .limit(limit)
  }

  /**
   * Produits demandables : actifs, d'une organisation vivante et non rejetés.
   */
  private visibleForRfq() {
    return Product.query()
      .where('isActive', true)
      .withScopes((scopes) => {
        scopes.fromLiveOrganization()
        scopes.notRejected()
      })
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
   * Catégories mises en avant sur l'accueil : les premières catégories ayant
   * au moins un produit actif (même règle de visibilité que le filtre).
   */
  async featuredCategories(limit: number): Promise<Category[]> {
    const categories = await this.availableCategories()
    return categories.slice(0, limit)
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
