import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import ActivityEventService from '#services/activity_event_service'
import ProductCatalogueService from '#services/product_catalogue_service'
import ProductSearchService from '#services/product_search_service'
import CatalogueFacetBarService from '#services/catalogue_facet_bar_service'
import CatalogueCertificationFacetService from '#services/catalogue_certification_facet_service'
import CatalogueEnumFacetService from '#services/catalogue_enum_facet_service'
import CatalogueNumericFacetService from '#services/catalogue_numeric_facet_service'
import DocumentService from '#services/document_service'
import OrganizationContextService from '#services/organization_context_service'
import { isImageSearchAvailable } from '#services/vision/image_search_availability'
import RfqService from '#services/rfq_service'
import SearchEventService from '#services/search_event_service'
import ProductTransformer from '#transformers/product_transformer'
import RfqDraftOptionTransformer from '#transformers/rfq_draft_option_transformer'
import ProductDetailTransformer from '#transformers/product_detail_transformer'
import CategoryTransformer from '#transformers/category_transformer'
import { ProductNotFoundException } from '#exceptions/catalogue_errors'
import { NoCurrentOrganizationException } from '#exceptions/organization_errors'
import type { Locale } from '#shared/types/i18n'
import { IMAGE_SEARCH_FLASH_KEY } from '#shared/types/image_search'
import type { SearchTrace } from '#shared/types/search_event'
import {
  ORIGIN_ZONES,
  PRODUCT_STOCK_STATUSES,
  PRICE_BUCKETS,
  MOQ_BUCKETS,
  type NumericBucket,
  type OriginZone,
  type ProductStockStatus,
  type AttributeRangeSelectionType,
  type ProductDirectoryFilters,
} from '#shared/types/product'
import type { ProductRfqContextType } from '#shared/types/rfq'

const PER_PAGE = 12

@inject()
export default class ProductsController {
  constructor(
    private service: ProductCatalogueService,
    private productSearch: ProductSearchService,
    private facetBar: CatalogueFacetBarService,
    private certificationFacets: CatalogueCertificationFacetService,
    private numericFacets: CatalogueNumericFacetService,
    private enumFacets: CatalogueEnumFacetService,
    private documents: DocumentService,
    private organizations: OrganizationContextService,
    private rfqs: RfqService,
    private searchEvents: SearchEventService,
    private activityEvents: ActivityEventService
  ) {}

  /**
   * Catalogue public paginé + filtrable : recherche par terme (Meilisearch),
   * filtre catégorie / made-in-Europe, facettes attributs en ET fiable.
   */
  async index({ inertia, request, session, i18n, auth }: HttpContext) {
    const locale = i18n.locale as Locale
    const qs = request.qs()

    const filters: ProductDirectoryFilters = {
      search: typeof qs.search === 'string' && qs.search.trim() ? qs.search.trim() : null,
      categoryId: Number.parseInt(qs.categoryId, 10) || null,
      madeInEurope: qs.madeInEurope === 'true',
      attributeValueIds: this.parseIds(qs.attributeValueIds),
      // Labels de conformité (écart 4, ÉTAPE 6) : facette transverse aux catégories.
      certificationIds: this.parseIds(qs.certificationIds),
      // Provenance à 3 états (écart 9) et filtre « Nouveautés » (écart 5).
      originZones: this.parseOriginZones(qs.originZones),
      // Statut de stock (plan L98) : facette transverse aux catégories.
      stockStatuses: this.parseStockStatuses(qs.stockStatuses),
      // Tranches numériques (plan L125) : prix et MOQ (facettes transverses, index
      // dans la liste fermée partagée), tranches d'attributs EAV (slug + bornes).
      priceBuckets: this.parseBuckets(qs.priceBuckets, PRICE_BUCKETS),
      moqBuckets: this.parseBuckets(qs.moqBuckets, MOQ_BUCKETS),
      attributeRanges: this.parseAttributeRanges(qs.attributeRanges),
      newOnly: qs.newOnly === 'true',
      // Filtre dérivé « Éco-responsable » (écart 4).
      ecoOnly: qs.ecoOnly === 'true',
    }
    const page = Number.parseInt(qs.page, 10) || 1
    // Terme issu d'une photo (recherche par image) : le contrôleur d'envoi le pose en
    // flash le temps de la redirection. Ce n'est pas un paramètre d'URL, donc non falsifiable.
    const imageSearch =
      filters.search !== null &&
      session.flashMessages.get(IMAGE_SEARCH_FLASH_KEY) === filters.search

    // Avec un terme : Meilisearch (ADR 0002). Sans terme, simple navigation par
    // catégories et filtres, servie par PostgreSQL. Moteur indisponible : la
    // recherche l'est aussi, la page le dit au lieu de répondre « aucun résultat ».
    const trace: SearchTrace = {}
    const searched = filters.search
      ? await this.productSearch.search({ ...filters, page, perPage: PER_PAGE }, trace)
      : undefined
    const searchUnavailable = searched === null
    const paginator = filters.search
      ? searched
      : await this.service.list({
          ...filters,
          page,
          perPage: PER_PAGE,
          sort: qs.sort === 'price_asc' ? 'price_asc' : null,
        })
    // Journal des recherches (#171) : mis en file, n'échoue jamais.
    await this.searchEvents.trackCatalogue({
      filters,
      page,
      mode: trace.mode ?? 'unavailable',
      total: paginator?.total ?? 0,
      user: auth.user ?? null,
      locale,
      fromImage: imageSearch,
    })

    // Lectures indépendantes, exécutées en parallèle (un round-trip Meilisearch
    // chacune pour les deux barres) :
    // - `categories` : catégories disponibles ;
    // - `facetBar` : barre pilotée par la catégorie sélectionnée — attributs
    //   filtrables résolus (propres + hérités) + compteurs (distributions de
    //   facettes). Sans catégorie, pas de filtres d'attributs (bar vide) ;
    // - `certificationFacet` : barre certifications, transverse aux catégories
    //   (écart 4, ÉTAPE 6), donc globale — disponible même sans catégorie.
    // - `numericFacets` : facettes transverses prix / MOQ à buckets (plan L125),
    //   globales (comme certifications), avec compteurs par tranche.
    // - `enumFacets` : compteurs provenance / stock, pour masquer les options vides.
    const [categories, facetBar, certificationFacet, numericFacets, enumFacets] = await Promise.all(
      [
        this.service.availableCategories(),
        this.facetBar.forCategory(filters.categoryId, locale, {
          search: filters.search,
          madeInEurope: filters.madeInEurope,
        }),
        this.certificationFacets.forCatalogue(filters, locale),
        this.numericFacets.forCatalogue(filters),
        this.enumFacets.forCatalogue(filters),
      ]
    )

    return inertia.render('products/index', {
      products: {
        data: (paginator?.all() ?? []).map((product) =>
          new ProductTransformer(product, locale).toObject()
        ),
        meta: {
          total: paginator?.total ?? 0,
          perPage: paginator?.perPage ?? PER_PAGE,
          currentPage: paginator?.currentPage ?? 1,
          lastPage: paginator?.lastPage ?? 1,
        },
      },
      searchUnavailable,
      filters,
      imageSearch,
      // Bouton d'envoi de photo : fonction active, acheteur connecté et e-mail vérifié
      // (la route l'exige, sinon le clic mènerait à l'écran de vérification).
      imageSearchEnabled: Boolean(auth.user?.emailVerifiedAt) && isImageSearchAvailable(),
      categories: categories.map((category) =>
        new CategoryTransformer(category, locale).toObject()
      ),
      facetBar,
      certificationFacet,
      numericFacets,
      enumFacets,
    })
  }

  /**
   * Fiche produit publique : produit localisé + fournisseur, catégorie, facettes.
   */
  async show({ inertia, params, i18n, auth, bouncer }: HttpContext) {
    const locale = i18n.locale as Locale
    const product = await this.service.findBySlug(params.slug)

    if (!product) {
      throw new ProductNotFoundException()
    }

    await this.activityEvents.record({
      type: 'product_viewed',
      targetType: 'product',
      targetId: product.id,
      userId: auth.user?.id ?? null,
      organizationId: auth.user?.currentOrganizationId ?? null,
      isStaff: auth.user?.hasBackOffice ?? false,
    })

    return inertia.render('products/show', {
      product: new ProductDetailTransformer(product, locale, this.documents.urlFor).toObject(),
      rfqContext: await this.rfqContext({ auth, bouncer }),
    })
  }

  /**
   * Ce que l'acheteur connecté peut faire de cette fiche : demander un devis,
   * ou l'ajouter à un brouillon. Page publique : un visiteur anonyme, ou un
   * utilisateur sans organisation courante, reçoit simplement « non ».
   */
  private async rfqContext({
    auth,
    bouncer,
  }: Pick<HttpContext, 'auth' | 'bouncer'>): Promise<ProductRfqContextType> {
    const none = { canCreateRfq: false, drafts: [] }
    if (!auth.user) return none

    let org
    try {
      org = await this.organizations.currentFor(auth.user)
    } catch (error) {
      if (error instanceof NoCurrentOrganizationException) return none
      throw error
    }

    if (!(await bouncer.allows('canCreateRfq', org))) return none

    const drafts = (await bouncer.allows('canManageRfq', org))
      ? await this.rfqs.listDrafts(org.id)
      : []
    return {
      canCreateRfq: true,
      drafts: drafts.map((draft) => new RfqDraftOptionTransformer(draft).toObject()),
    }
  }

  /**
   * Normalise le paramètre `attributeValueIds` (répété ou unique) en `number[]`.
   */
  private parseIds(raw: unknown): number[] {
    const list = Array.isArray(raw) ? raw : raw !== undefined ? [raw] : []
    return list
      .map((value) => Number.parseInt(String(value), 10))
      .filter((value) => Number.isInteger(value) && value > 0)
  }

  /**
   * Normalise le paramètre `originZones` (répété ou unique) en zones valides
   * (écart 9) ; ignore toute valeur hors de l'enum.
   */
  private parseOriginZones(raw: unknown): OriginZone[] {
    const list = Array.isArray(raw) ? raw : raw !== undefined ? [raw] : []
    const valid = new Set<string>(ORIGIN_ZONES)
    return list
      .map((value) => String(value))
      .filter((value): value is OriginZone => valid.has(value))
  }

  /**
   * Normalise le paramètre `stockStatuses` (répété ou unique) en statuts valides
   * (plan L98) ; ignore toute valeur hors de l'enum.
   */
  private parseStockStatuses(raw: unknown): ProductStockStatus[] {
    const list = Array.isArray(raw) ? raw : raw !== undefined ? [raw] : []
    const valid = new Set<string>(PRODUCT_STOCK_STATUSES)
    return list
      .map((value) => String(value))
      .filter((value): value is ProductStockStatus => valid.has(value))
  }

  /**
   * Normalise le paramètre d'une facette à buckets (`priceBuckets`/`moqBuckets`,
   * plan L125) : des **index** dans la liste fermée partagée. Dédoublonne et ignore
   * tout index non entier ou hors bornes — le serveur ne fait jamais confiance à la
   * query string pour les bornes elles-mêmes (codées dans la constante partagée).
   */
  private parseBuckets(raw: unknown, buckets: readonly NumericBucket[]): number[] {
    const list = Array.isArray(raw) ? raw : raw !== undefined ? [raw] : []
    const seen = new Set<number>()
    for (const value of list) {
      const index = Number.parseInt(String(value), 10)
      if (Number.isInteger(index) && index >= 0 && index < buckets.length) seen.add(index)
    }
    return [...seen]
  }

  /**
   * Normalise le paramètre `attributeRanges` (plan L125) : des chaînes
   * `"<slug>:<min>:<max>"` (borne vide = ouverte). Ignore toute entrée malformée —
   * slug invalide, borne non numérique, ou tranche entièrement ouverte.
   */
  private parseAttributeRanges(raw: unknown): AttributeRangeSelectionType[] {
    const list = Array.isArray(raw) ? raw : raw !== undefined ? [raw] : []
    const result: AttributeRangeSelectionType[] = []
    for (const entry of list) {
      const parts = String(entry).split(':')
      if (parts.length !== 3) continue
      const [slug, rawMin, rawMax] = parts
      if (!/^[a-z0-9-]+$/.test(slug)) continue
      const minValue = this.parseBound(rawMin)
      const maxValue = this.parseBound(rawMax)
      // Borne invalide, ou tranche entièrement ouverte : on ignore.
      if (minValue === undefined || maxValue === undefined) continue
      if (minValue === null && maxValue === null) continue
      result.push({ slug, minValue, maxValue })
    }
    return result
  }

  /** Une borne de tranche : vide = ouverte (`null`), nombre fini sinon ; `undefined` = invalide. */
  private parseBound(raw: string): number | null | undefined {
    if (raw === '') return null
    const value = Number(raw)
    return Number.isFinite(value) ? value : undefined
  }
}
