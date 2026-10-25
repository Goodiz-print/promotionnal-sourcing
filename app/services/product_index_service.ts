import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import searchConfig from '#config/search'
import Product from '#models/product'
import SearchEngine from '#services/search/search_engine'
import { SEARCH_EMBEDDER } from '#shared/types/search'
import type { ContentLocale } from '#shared/types/i18n'
import type { ProductSearchDocument, ProductSyncResult } from '#shared/types/search'

/**
 * Synchronisation PostgreSQL → index de recherche (#112).
 *
 * PostgreSQL est la source de vérité : ce service **reconstruit** le document
 * d'un produit à partir de la base à chaque passage, jamais à partir d'un état
 * mémorisé. Il est donc idempotent — rejouer un lot (reprise après échec,
 * doublon de job) donne le même index — et sûr dans le désordre : le dernier
 * passage reflète toujours l'état courant de la base.
 *
 * Un produit devenu invisible (inactif, rejeté, organisation archivée ou
 * rejetée) sort de l'index, mêmes règles que la fiche publique.
 */
@inject()
export default class ProductIndexService {
  constructor(private engine: SearchEngine) {}

  get enabled(): boolean {
    return this.engine.enabled
  }

  /**
   * Aligne l'index sur la base pour ces produits : les visibles sont (ré)écrits,
   * les autres — y compris supprimés — sont retirés.
   */
  async sync(productIds: number[]): Promise<ProductSyncResult> {
    const ids = [...new Set(productIds)]
    if (ids.length === 0) return { indexed: 0, removed: 0 }

    const documents = await this.documentsFor(ids)
    const present = new Set(documents.map((document) => document.id))
    const gone = ids.filter((id) => !present.has(id))

    await this.engine.upsert(documents)
    await this.engine.remove(gone)
    return { indexed: documents.length, removed: gone.length }
  }

  /**
   * Aligne l'index pour tous les produits d'une organisation — son archivage ou
   * sa modération change la visibilité de tout son catalogue.
   */
  async syncOrganization(organizationId: number): Promise<ProductSyncResult> {
    const rows = await db
      .from('products')
      .join('suppliers', 'suppliers.id', 'products.supplier_id')
      .where('suppliers.organization_id', organizationId)
      .select('products.id')

    const total: ProductSyncResult = { indexed: 0, removed: 0 }
    const ids = rows.map((row: { id: number }) => row.id)
    for (let from = 0; from < ids.length; from += searchConfig.batchSize) {
      const result = await this.sync(ids.slice(from, from + searchConfig.batchSize))
      total.indexed += result.indexed
      total.removed += result.removed
    }
    return total
  }

  /**
   * Reconstruit tout l'index depuis la base (`search:reindex`). Parcours par
   * identifiant croissant, par lots : la mémoire reste bornée quel que soit le
   * volume. L'échange d'index est atomique (cf. `SearchEngine#replaceAll`) : un
   * échec laisse l'ancien index en place, la commande peut être relancée.
   */
  async reindexAll(): Promise<number> {
    return this.engine.replaceAll(this.allDocuments())
  }

  private async *allDocuments(): AsyncGenerator<ProductSearchDocument[]> {
    let afterId = 0
    for (;;) {
      const rows = await Product.query()
        .where('id', '>', afterId)
        .orderBy('id')
        .limit(searchConfig.batchSize)
        .select('id')
      if (rows.length === 0) return

      afterId = rows[rows.length - 1].id
      const documents = await this.documentsFor(rows.map((row) => row.id))
      if (documents.length > 0) yield documents
    }
  }

  /** Documents des produits **visibles** parmi ces identifiants. */
  private async documentsFor(ids: number[]): Promise<ProductSearchDocument[]> {
    const products = await this.visibleProducts()
      .whereIn('products.id', ids)
      .preload('translations')
      .preload('productAttributes')
    if (products.length === 0) return []

    const vectors = await this.vectorsFor(products.map((product) => product.id))
    return products.map((product) => this.toDocument(product, vectors.get(product.id) ?? null))
  }

  /** Mêmes règles de visibilité que la fiche publique (`findBySlug`). */
  private visibleProducts() {
    return Product.query()
      .where('isActive', true)
      .withScopes((scopes) => {
        scopes.fromLiveOrganization()
        scopes.notRejected()
      })
  }

  /**
   * Vecteurs stockés, lus en texte (`halfvec` n'a pas de type côté driver) puis
   * décodés — le littéral pgvector `[0.1,0.2]` est aussi du JSON.
   */
  private async vectorsFor(ids: number[]): Promise<Map<number, number[]>> {
    const rows = await db
      .from('products')
      .whereIn('id', ids)
      .whereNotNull('embedding')
      .select('id', db.raw('embedding::text as embedding'))

    return new Map(
      rows.map((row: { id: number; embedding: string }) => [
        row.id,
        JSON.parse(row.embedding) as number[],
      ])
    )
  }

  private toDocument(product: Product, vector: number[] | null): ProductSearchDocument {
    const names: Partial<Record<ContentLocale, string>> = {}
    const descriptions: Partial<Record<ContentLocale, string>> = {}
    for (const translation of product.translations) {
      const locale = translation.locale as ContentLocale
      if (translation.name) names[locale] = translation.name
      if (translation.description) descriptions[locale] = translation.description
    }

    return {
      id: product.id,
      slug: product.slug,
      reference: product.reference,
      categoryId: product.categoryId,
      supplierId: product.supplierId,
      madeInEurope: product.madeInEurope,
      originCountry: product.originCountry,
      attributeValueIds: [
        ...new Set(
          product.productAttributes.flatMap((row) =>
            row.attributeValueId === null ? [] : [row.attributeValueId]
          )
        ),
      ],
      names,
      descriptions,
      _vectors: { [SEARCH_EMBEDDER]: vector },
    }
  }
}
