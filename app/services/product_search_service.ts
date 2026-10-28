import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import { ModelPaginator } from '@adonisjs/lucid/orm'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import searchConfig from '#config/search'
import Product from '#models/product'
import SearchEngine from '#services/search/search_engine'
import { NEW_PRODUCT_WINDOW_DAYS, type ProductDirectoryFilters } from '#shared/types/product'
import type { ProductSearchHits, ProductSearchRequest } from '#shared/types/search'

/**
 * Seuil « Nouveautés » (écart 5) : début de la fenêtre récente. `null` quand le
 * filtre n'est pas demandé.
 */
function newProductThreshold(newOnly: boolean): DateTime | null {
  return newOnly ? DateTime.now().minus({ days: NEW_PRODUCT_WINDOW_DAYS }).startOf('day') : null
}

/** Paramètres d'une recherche du catalogue public. */
export interface CatalogueSearchOptions extends ProductDirectoryFilters {
  page: number
  perPage: number
}

/**
 * Recherche des produits par Meilisearch (#112, ADR 0002) : mots-clés + sémantique
 * (Meilisearch vectorise lui-même la requête), filtres exacts, puis
 * **rechargement depuis PostgreSQL**.
 *
 * Ce que le moteur renvoie n'est qu'une liste ordonnée d'identifiants. La base
 * reste juge de ce qu'on affiche : un produit retiré, rejeté ou d'une
 * organisation archivée depuis la dernière synchronisation est écarté ici, et
 * les facettes demandées sont revérifiées sur la page rechargée (le ET est donc
 * garanti deux fois, par le filtre du moteur puis par la base).
 *
 * Les méthodes renvoient `null` quand la recherche n'est pas disponible — moteur
 * inerte (pas de `MEILISEARCH_HOST`) ou injoignable : l'appelant retombe sur la
 * recherche PostgreSQL, qui disparaît avec la PR 3 de #112.
 */
@inject()
export default class ProductSearchService {
  constructor(private engine: SearchEngine) {}

  get enabled(): boolean {
    return this.engine.enabled
  }

  /**
   * Résultats paginés du catalogue public pour une requête. `null` : recherche
   * indisponible, utiliser le repli.
   */
  async search(options: CatalogueSearchOptions): Promise<ModelPaginatorContract<Product> | null> {
    const query = options.search?.trim()
    if (!this.enabled || !query) return null

    const threshold = newProductThreshold(options.newOnly)
    const hits = await this.query({
      query,
      semanticRatio: searchConfig.embedder.enabled ? searchConfig.semanticRatio : 0,
      filter: {
        categoryId: options.categoryId,
        madeInEurope: options.madeInEurope,
        attributeValueIds: options.attributeValueIds,
        // Labels de conformité (écart 4, ÉTAPE 6) : ET exact.
        certificationIds: options.certificationIds,
        originZones: options.originZones,
        // Statut de stock (plan L98) : OU entre les statuts cochés.
        stockStatuses: options.stockStatuses,
        releasedAfter: threshold ? Math.trunc(threshold.toSeconds()) : null,
        // Éco-responsable (écart 4).
        isEco: options.ecoOnly,
      },
      page: options.page,
      perPage: options.perPage,
    })
    if (!hits) return null

    const products = await this.reload(hits.ids, options)
    return new ModelPaginator(hits.total, options.perPage, options.page, ...products)
  }

  /**
   * Produits proposés par le sélecteur d'une demande de devis : mots-clés seuls
   * (pas d'appel au provider d'embeddings à chaque frappe), au plus `limit`
   * résultats visibles. `null` : recherche indisponible, utiliser le repli.
   */
  async lookup(search: string, limit: number): Promise<Product[] | null> {
    const query = search.trim()
    if (!this.enabled || !query) return null

    const hits = await this.query({
      query,
      semanticRatio: 0,
      filter: {},
      page: 1,
      perPage: limit,
    })
    if (!hits) return null

    return this.reload(hits.ids, null, true)
  }

  /**
   * Interroge le moteur. Une recherche sémantique qui échoue — l'API d'embeddings
   * est indisponible ou limitée en débit, Meilisearch ne peut pas vectoriser la
   * requête — est **rejouée par mots-clés seuls** : la recherche ne tombe jamais
   * à cause de l'IA. Moteur injoignable, même en mots-clés : `null` (repli).
   */
  private async query(request: ProductSearchRequest): Promise<ProductSearchHits | null> {
    try {
      return await this.engine.search(request)
    } catch (error) {
      if (request.semanticRatio > 0) {
        logger.warn({ err: error }, 'semantic search failed, retrying with keywords only')
        return this.query({ ...request, semanticRatio: 0 })
      }
      logger.warn({ err: error }, 'search engine unavailable, falling back to postgres')
      return null
    }
  }

  /**
   * Recharge les produits retournés par le moteur depuis PostgreSQL, dans l'ordre
   * du moteur. Un identifiant dont le produit n'est plus visible, ou ne porte
   * plus les facettes demandées, disparaît de la page.
   */
  private async reload(
    ids: number[],
    filters: ProductDirectoryFilters | null,
    withSupplier = false
  ): Promise<Product[]> {
    if (ids.length === 0) return []

    const query = this.visible().whereIn('products.id', ids).preload('translations')
    if (filters?.categoryId) query.where('categoryId', filters.categoryId)
    if (filters?.madeInEurope) query.where('madeInEurope', true)
    for (const valueId of filters?.attributeValueIds ?? []) {
      query.whereHas('attributeValues', (av) => av.where('attribute_values.id', valueId))
    }
    // Labels de conformité (écart 4, ÉTAPE 6) : ET fiable, revérifié sur la base
    // (un `whereHas` par label → chaque contrainte est combinée en AND).
    for (const certificationId of filters?.certificationIds ?? []) {
      query.whereHas('certifications', (c) => c.where('certifications.id', certificationId))
    }
    // Provenance (écart 9) : OU entre zones cochées ; revérifié sur la base.
    const zones = filters?.originZones ?? []
    if (zones.length > 0) query.whereIn('originZone', zones)
    // Statut de stock (plan L98) : OU entre statuts cochés ; revérifié sur la base.
    const statuses = filters?.stockStatuses ?? []
    if (statuses.length > 0) query.whereIn('stockStatus', statuses)
    // Nouveautés (écart 5) : sorti depuis le seuil.
    const threshold = newProductThreshold(filters?.newOnly ?? false)
    if (threshold) query.where('releasedAt', '>=', threshold.toSQLDate()!)
    // Éco-responsable (écart 4) : revérifié sur la base.
    if (filters?.ecoOnly) query.where('isEco', true)
    if (withSupplier) query.preload('supplier', (supplier) => supplier.preload('organization'))

    const found = await query
    const byId = new Map(found.map((product) => [product.id, product]))
    return ids.flatMap((id) => {
      const product = byId.get(id)
      return product ? [product] : []
    })
  }

  /** Mêmes règles de visibilité que la fiche publique (`findBySlug`). */
  private visible() {
    return Product.query()
      .where('isActive', true)
      .withScopes((scopes) => {
        scopes.fromLiveOrganization()
        scopes.notRejected()
      })
  }
}
