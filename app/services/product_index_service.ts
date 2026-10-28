import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import searchConfig from '#config/search'
import Product from '#models/product'
import SearchEngine from '#services/search/search_engine'
import ProductOriginService from '#services/product_origin_service'
import ProductEcoService from '#services/product_eco_service'
import ProductStockService from '#services/product_stock_service'
import { resolveTranslation } from '#shared/helpers/translations'
import { MATERIAL_ATTRIBUTE_SLUG } from '#shared/types/certification'
import type { ContentLocale, Locale } from '#shared/types/i18n'
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
/** Longueur maximale du début de description envoyé au modèle d'embeddings. */
const DESCRIPTION_LENGTH = 300

@inject()
export default class ProductIndexService {
  constructor(
    private engine: SearchEngine,
    private origin: ProductOriginService,
    private eco: ProductEcoService,
    private stock: ProductStockService
  ) {}

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
      .preload('category', (category) => category.preload('translations'))
      .preload('productAttributes', (rows) =>
        rows
          .preload('attribute', (attribute) => attribute.preload('translations'))
          .preload('attributeValue', (value) =>
            value
              .preload('translations')
              // La **famille** (N1) d'une nuance (N2) : on l'émet sous
              // `attributes.<slug de la famille>` même sans ligne de facette
              // explicite (cf. `flattenedFacets`).
              .preload('parent', (parent) => parent.preload('attribute'))
          )
      )
      .preload('certifications')
      // Stock agrégé (plan L98) : seules les colonnes utiles à la dérivation.
      .preload('variants', (variants) =>
        variants.select('id', 'productId', 'isActive', 'stockStatus')
      )
    if (products.length === 0) return []

    // Backfill : les colonnes dérivées (zone de provenance — écart 9 — et
    // « Éco-responsable » — écart 4) sont recalculées et persistées au passage.
    // PostgreSQL reste la source de vérité ; une réindexation complète rattrape
    // ainsi les fiches dont l'origine, les matières ou les labels ont changé sans
    // repasser par le formulaire. Idempotent : seules les lignes qui changent
    // sont réécrites.
    await this.backfillDerivedColumns(products)

    return products.map((product) => this.toDocument(product))
  }

  /**
   * Recale les colonnes dérivées (`origin_zone`, écart 9 ; `is_eco`, écart 4 ;
   * `stock_status`, plan L98) sur leur dérivation courante. Idempotent : n'écrit
   * que les lignes qui changent.
   */
  private async backfillDerivedColumns(products: Product[]): Promise<void> {
    for (const product of products) {
      const zone = this.origin.deriveZone(product.originCountry, product.madeInEurope)
      const isEco = this.eco.deriveIsEco({
        recycledContentPercent: product.recycledContentPercent,
        // Seules les valeurs de l'attribut `material` comptent comme matière éco.
        materialSlugs: product.productAttributes.flatMap((row) =>
          row.attribute?.slug === MATERIAL_ATTRIBUTE_SLUG && row.attributeValue
            ? [row.attributeValue.slug]
            : []
        ),
        hasEcoCertification: product.certifications.some((certification) => certification.isEco),
      })
      // Stock agrégé (plan L98) : priorité au disponible, variantes actives seules.
      const stockStatus = this.stock.deriveStatus(product.variants)
      if (
        zone !== product.originZone ||
        isEco !== product.isEco ||
        stockStatus !== product.stockStatus
      ) {
        product.originZone = zone
        product.isEco = isEco
        product.stockStatus = stockStatus
        await product.save()
      }
    }
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

  private toDocument(product: Product): ProductSearchDocument {
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
      // Provenance dérivée (écart 9) et date de sortie en timestamp Unix pour
      // le filtre « Nouveautés » (écart 5).
      originZone: product.originZone,
      // Statut de stock agrégé (plan L98) — recalé au backfill ci-dessus.
      stockStatus: product.stockStatus,
      // Prix du palier le plus bas et MOQ (plan L125) pour les facettes à buckets
      // « Prix » / « MOQ ». Données directes (colonnes existantes), jamais dérivées :
      // `price_min` est un décimal sérialisé en chaîne → émis en nombre.
      priceMin: product.priceMin === null ? null : Number(product.priceMin),
      moq: product.minQuantity,
      releasedAt: product.releasedAt ? Math.trunc(product.releasedAt.toSeconds()) : null,
      // Filtre dérivé « Éco-responsable » (écart 4) — recalé au backfill ci-dessus.
      isEco: product.isEco,
      attributeValueIds: [
        ...new Set(
          product.productAttributes.flatMap((row) =>
            row.attributeValueId === null ? [] : [row.attributeValueId]
          )
        ),
      ],
      // Labels de conformité (écart 4, ÉTAPE 6) : facette transverse aux
      // catégories. Donnée directe (pivot `product_certifications`, préchargé),
      // jamais dérivée — `search:reindex` suffit à peupler la facette.
      certificationIds: [
        ...new Set(product.certifications.map((certification) => certification.id)),
      ],
      attributes: ProductIndexService.flattenedFacets(product),
      names,
      descriptions,
      embeddingText: ProductIndexService.embeddingText(product),
    }
  }

  /**
   * Facettes **aplaties par slug d'attribut** (`attributes.color`,
   * `attributes.color-shade`…) pour les distributions de facettes et la barre de
   * filtres dépendante de la catégorie :
   *
   * - une valeur énumérée porte son **identifiant** (`attribute_values.id`) sous
   *   le slug de son attribut ;
   * - la **famille** (N1) d'une nuance (N2) est aussi émise sous le slug de la
   *   famille, dérivée du `parent_value_id` — le filtre et le compteur par
   *   famille fonctionnent même sans ligne de facette famille explicite ;
   * - un attribut numérique porte sa **valeur brute**.
   *
   * Suppose `productAttributes` préchargés avec `attribute`, `attributeValue` et
   * `attributeValue.parent.attribute`.
   */
  static flattenedFacets(product: Product): Record<string, number[]> {
    const bySlug = new Map<string, Set<number>>()
    const add = (slug: string, value: number) => {
      const set = bySlug.get(slug) ?? new Set<number>()
      set.add(value)
      bySlug.set(slug, set)
    }

    for (const row of product.productAttributes) {
      const value = row.attributeValue
      if (value) {
        add(row.attribute.slug, value.id)
        if (value.parent) add(value.parent.attribute.slug, value.parent.id)
      } else if (row.valueNumber !== null) {
        add(row.attribute.slug, Number(row.valueNumber))
      }
    }

    const facets: Record<string, number[]> = {}
    for (const [slug, values] of bySlug) facets[slug] = [...values]
    return facets
  }

  /**
   * Texte que Meilisearch vectorise (ADR 0002, décision 4) — conçu pour la
   * recherche, pas pour l'affichage :
   *
   * 1. le nom dans la **langue source** de la fiche seule (le modèle est
   *    multilingue ; concaténer les traductions allonge le texte et le fait
   *    changer à chaque traduction automatique, donc ré-embedder) ;
   * 2. la catégorie, dans la même langue ;
   * 3. les facettes « attribut : valeur » (« couleur : noir ») ;
   * 4. le début de la description, tronqué à `DESCRIPTION_LENGTH` caractères.
   *
   * Suppose `translations`, `category` et `productAttributes` (avec leurs
   * traductions) préchargés. Les libellés absents dans la langue source
   * retombent sur la langue par défaut, puis sur la première traduction.
   */
  static embeddingText(product: Product): string {
    const locale = (product.sourceLocale || 'fr') as Locale
    const name = resolveTranslation(product.translations, locale)

    const facets = product.productAttributes.flatMap((row) => {
      const attribute = resolveTranslation(row.attribute.translations, locale)?.name
      const value = row.attributeValue
        ? resolveTranslation(row.attributeValue.translations, locale)?.label
        : (row.valueString ??
          (row.valueNumber ? `${row.valueNumber} ${row.attribute.unit ?? ''}` : null))
      return attribute && value ? [`${attribute} : ${value}`.trim()] : []
    })

    const description = name?.description?.trim().slice(0, DESCRIPTION_LENGTH)
    const category = product.category
      ? resolveTranslation(product.category.translations, locale)?.name
      : null

    return [name?.name, category, ...facets, description]
      .filter((part): part is string => Boolean(part))
      .join('\n')
  }
}
