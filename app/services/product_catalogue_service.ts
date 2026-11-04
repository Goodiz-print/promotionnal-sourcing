import { DateTime } from 'luxon'
import Product from '#models/product'
import Category from '#models/category'
import Attribute from '#models/attribute'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import { applyProductRangeFilters } from '#services/product_range_filters'
import {
  NEW_PRODUCT_WINDOW_DAYS,
  type ProductDirectoryFilters,
  type ProductSort,
} from '#shared/types/product'

interface ListOptions extends ProductDirectoryFilters {
  page: number
  perPage: number
  // `price_asc` : tri par prix unitaire du premier palier.
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
   * - navigation sans terme de recherche (la recherche par terme est servie par
   *   `ProductSearchService`, ADR 0002) ;
   * - filtre catégorie et made-in-Europe ;
   * - facettes attributs en **ET fiable** (un `whereHas` par valeur → chaque
   *   contrainte est combinée en `AND`, cf. `docs/catalogue.md`).
   */
  list(options: ListOptions): Promise<ModelPaginatorContract<Product>> {
    const {
      page,
      perPage,
      categoryId,
      madeInEurope,
      attributeValueIds,
      certificationIds,
      originZones,
      stockStatuses,
      priceBuckets,
      moqBuckets,
      attributeRanges,
      newOnly,
      ecoOnly,
    } = options

    // Nouveautés (écart 5) : début de la fenêtre récente.
    const newThreshold = newOnly
      ? DateTime.now().minus({ days: NEW_PRODUCT_WINDOW_DAYS }).startOf('day')
      : null

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
      // Labels de conformité (écart 4, ÉTAPE 6) : ET fiable, un `whereHas` par
      // label → chaque contrainte combinée en AND (le produit porte *tous* les
      // labels cochés). Mêmes résultats que le filtre du moteur.
      .if(certificationIds.length > 0, (q) => {
        for (const certificationId of certificationIds) {
          q.whereHas('certifications', (c) => c.where('certifications.id', certificationId))
        }
      })
      // Provenance à 3 états (écart 9) : OU entre les zones cochées.
      .if(originZones.length > 0, (q) => q.whereIn('originZone', originZones))
      // Statut de stock (plan L98) : OU entre les statuts cochés ; colonne dérivée
      // agrégée au niveau produit. Mêmes résultats que le filtre du moteur.
      .if(stockStatuses.length > 0, (q) => q.whereIn('stockStatus', stockStatuses))
      // Tranches numériques (plan L125) : prix, MOQ et attributs EAV, `[min, max[`.
      // Mêmes résultats que le filtre du moteur (`applyProductRangeFilters`).
      .if(priceBuckets.length > 0 || moqBuckets.length > 0 || attributeRanges.length > 0, (q) =>
        applyProductRangeFilters(q, { priceBuckets, moqBuckets, attributeRanges })
      )
      // Nouveautés (écart 5).
      .if(newThreshold, (q) => q.where('releasedAt', '>=', newThreshold!.toSQLDate()!))
      // Éco-responsable (écart 4) : filtre dérivé booléen.
      .if(ecoOnly, (q) => q.where('isEco', true))
      .preload('translations')

    if (options.sort === 'price_asc') {
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
    return (
      Product.query()
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
        // Labels de conformité (écart 4) avec leurs traductions.
        .preload('certifications', (certifications) => certifications.preload('translations'))
        // Conditionnement / logistique (écart 3) : relation 1:1.
        .preload('packaging')
        // Marquage structuré (écart 2) : positions (avec techniques localisées) +
        // grille de prix de marquage. Donnée de fiche, jamais un filtre.
        .preload('markingPositions', (positions) =>
          positions
            .orderBy('position')
            .preload('techniques', (techniques) =>
              techniques
                .orderBy('id')
                .preload('technique', (technique) => technique.preload('translations'))
            )
        )
        // Grille groupée par technique, puis quantité croissante (chaque échelle
        // dégressive reste lisible d'un bloc).
        .preload('markingPriceTiers', (tiers) =>
          tiers
            .orderBy('markingTechniqueId')
            .orderBy('minQuantity')
            .preload('technique', (technique) => technique.preload('translations'))
        )
        .first()
    )
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
      .orderBy('position')
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
