import { inject } from '@adonisjs/core'
import type Product from '#models/product'
import AdAuctionService from '#services/ad_auction_service'
import AdImpressionService from '#services/ad_impression_service'
import ProductCatalogueService from '#services/product_catalogue_service'
import ProductSearchService from '#services/product_search_service'
import { runAdAuction } from '#shared/helpers/ad_auction'
import {
  AD_SLOTS,
  type AdAuctionCandidate,
  type AdAuctionWinner,
  type AdPlacement,
} from '#shared/types/ads'
import type { ProductDirectoryFilters } from '#shared/types/product'

/** Produit sponsorisé retenu pour un écran, avec le prix de son clic. */
export interface SponsoredSelection {
  product: Product
  winner: AdAuctionWinner
  placement: AdPlacement
}

/**
 * Produits sponsorisés à afficher sur un écran (cf. `docs/ads.md`).
 *
 * Le ciblage est la **pertinence seule** : un produit sponsorisé n'apparaît que
 * s'il répond à ce que l'acheteur regarde. Dans le catalogue, il doit respecter
 * le terme cherché **et tous les filtres actifs** — la sponsorisation fait
 * remonter un produit pertinent, elle ne contourne jamais le ET fiable.
 *
 * Enchaînement : campagnes éligibles (`AdAuctionService`) → produits pertinents
 * pour l'écran → enchère au second prix entre ces seuls produits
 * (`runAdAuction`) → comptage des affichages.
 */
@inject()
export default class SponsoredProductService {
  constructor(
    private auction: AdAuctionService,
    private catalogue: ProductCatalogueService,
    private search: ProductSearchService,
    private impressions: AdImpressionService
  ) {}

  /**
   * Tête du catalogue. Première page seulement. Avec un terme de recherche, la
   * pertinence est jugée par le moteur (mots-clés) ; sans terme, par les filtres
   * de navigation en base. Moteur indisponible : aucun produit sponsorisé.
   */
  async forCatalogue(
    filters: ProductDirectoryFilters,
    page: number
  ): Promise<SponsoredSelection[]> {
    if (page !== 1) return []

    const candidates = await this.auction.eligible()
    if (candidates.length === 0) return []

    const ids = candidates.map((candidate) => candidate.productId)
    const products = filters.search
      ? await this.search.matching(filters, ids)
      : await this.catalogue.matching(filters, ids)

    return this.select('catalogue', candidates, products ?? [])
  }

  /** Bas d'une fiche produit : produits sponsorisés de la même catégorie. */
  async forProduct(product: Product): Promise<SponsoredSelection[]> {
    const candidates = await this.auction.eligible({
      categoryId: product.categoryId,
      excludeProductIds: [product.id],
    })
    return this.selectVisible('product', candidates)
  }

  /** Accueil public : pas de contexte, les meilleures enchères l'emportent. */
  async forHome(): Promise<SponsoredSelection[]> {
    return this.selectVisible('home', await this.auction.eligible())
  }

  private async selectVisible(
    placement: AdPlacement,
    candidates: AdAuctionCandidate[]
  ): Promise<SponsoredSelection[]> {
    if (candidates.length === 0) return []
    // L'enchère d'abord : on ne charge que les produits gagnants.
    const winners = runAdAuction(candidates, AD_SLOTS[placement])
    const products = await this.catalogue.visibleByIds(winners.map((winner) => winner.productId))
    return this.select(placement, candidates, products, winners)
  }

  /**
   * Enchère entre les candidats dont le produit est pertinent (`products`),
   * puis comptage des affichages des gagnants.
   */
  private async select(
    placement: AdPlacement,
    candidates: AdAuctionCandidate[],
    products: Product[],
    precomputed?: AdAuctionWinner[]
  ): Promise<SponsoredSelection[]> {
    const byId = new Map(products.map((product) => [product.id, product]))
    const winners =
      precomputed ??
      runAdAuction(
        candidates.filter((candidate) => byId.has(candidate.productId)),
        AD_SLOTS[placement]
      )

    const selections = winners.flatMap((winner) => {
      const product = byId.get(winner.productId)
      return product ? [{ product, winner, placement }] : []
    })

    await this.impressions.record(
      selections.map((selection) => selection.winner.campaignId),
      placement
    )
    return selections
  }
}
