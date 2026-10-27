import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import ProductCatalogueService from '#services/product_catalogue_service'
import ProductSearchService from '#services/product_search_service'
import CatalogueFacetBarService from '#services/catalogue_facet_bar_service'
import DocumentService from '#services/document_service'
import OrganizationContextService from '#services/organization_context_service'
import RfqService from '#services/rfq_service'
import ProductTransformer from '#transformers/product_transformer'
import RfqDraftOptionTransformer from '#transformers/rfq_draft_option_transformer'
import ProductDetailTransformer from '#transformers/product_detail_transformer'
import CategoryTransformer from '#transformers/category_transformer'
import { ProductNotFoundException } from '#exceptions/catalogue_errors'
import { NoCurrentOrganizationException } from '#exceptions/organization_errors'
import type { Locale } from '#shared/types/i18n'
import { ORIGIN_ZONES, type OriginZone, type ProductDirectoryFilters } from '#shared/types/product'
import type { ProductRfqContextType } from '#shared/types/rfq'

const PER_PAGE = 12

@inject()
export default class ProductsController {
  constructor(
    private service: ProductCatalogueService,
    private productSearch: ProductSearchService,
    private facetBar: CatalogueFacetBarService,
    private documents: DocumentService,
    private organizations: OrganizationContextService,
    private rfqs: RfqService
  ) {}

  /**
   * Catalogue public paginé + filtrable : recherche par terme (Meilisearch),
   * filtre catégorie / made-in-Europe, facettes attributs en ET fiable.
   */
  async index({ inertia, request, i18n }: HttpContext) {
    const locale = i18n.locale as Locale
    const qs = request.qs()

    const filters: ProductDirectoryFilters = {
      search: typeof qs.search === 'string' && qs.search.trim() ? qs.search.trim() : null,
      categoryId: Number.parseInt(qs.categoryId, 10) || null,
      madeInEurope: qs.madeInEurope === 'true',
      attributeValueIds: this.parseIds(qs.attributeValueIds),
      // Provenance à 3 états (écart 9) et filtre « Nouveautés » (écart 5).
      originZones: this.parseOriginZones(qs.originZones),
      newOnly: qs.newOnly === 'true',
      // Filtre dérivé « Éco-responsable » (écart 4).
      ecoOnly: qs.ecoOnly === 'true',
    }
    const page = Number.parseInt(qs.page, 10) || 1

    // Avec un terme : Meilisearch (ADR 0002). Sans terme, simple navigation par
    // catégories et filtres, servie par PostgreSQL. Moteur indisponible : la
    // recherche l'est aussi, la page le dit au lieu de répondre « aucun résultat ».
    const searched = filters.search
      ? await this.productSearch.search({ ...filters, page, perPage: PER_PAGE })
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
    const categories = await this.service.availableCategories()
    // Barre de filtres pilotée par la catégorie sélectionnée : attributs
    // filtrables résolus (propres + hérités) + compteurs (distributions de
    // facettes). Sans catégorie, pas de filtres d'attributs (bar vide).
    const facetBar = await this.facetBar.forCategory(filters.categoryId, locale, {
      search: filters.search,
      madeInEurope: filters.madeInEurope,
    })

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
      categories: categories.map((category) =>
        new CategoryTransformer(category, locale).toObject()
      ),
      facetBar,
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
}
