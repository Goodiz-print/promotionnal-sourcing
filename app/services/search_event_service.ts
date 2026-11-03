import logger from '@adonisjs/core/services/logger'
import RecordSearchEventJob from '#jobs/record_search_event_job'
import type User from '#models/user'
import type { ProductDirectoryFilters } from '#shared/types/product'
import type { SupplierDirectoryFilters } from '#shared/types/supplier'
import {
  SEARCH_EVENT_QUERY_MAX_LENGTH,
  type SearchEventFilters,
  type SearchEventMode,
  type SearchEventPayload,
} from '#shared/types/search_event'

/**
 * Journal des recherches des clients (#171).
 *
 * `track` est appelé depuis les écrans de recherche : il met l'événement en
 * file et **n'échoue jamais** (une file indisponible ne doit pas faire tomber
 * une recherche). L'écriture en base est dans `SearchEventStore`, appelé par les
 * jobs : ce service importe le job, il ne peut donc pas être importé par lui.
 */
export default class SearchEventService {
  /** Normalise un terme saisi : minuscules, espaces compactés, longueur bornée. */
  normalizeQuery(search: string | null | undefined): string | null {
    const normalized = (search ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
    return normalized ? normalized.slice(0, SEARCH_EVENT_QUERY_MAX_LENGTH) : null
  }

  /**
   * Recherche du catalogue. Seule la première page compte (pagination et tri ne
   * sont pas de nouvelles recherches) et seulement si le visiteur a cherché ou
   * filtré quelque chose. `total` : nombre de résultats de la recherche.
   */
  async trackCatalogue(options: {
    filters: ProductDirectoryFilters
    page: number
    mode: SearchEventMode
    total: number
    user: User | null
    locale: string
  }): Promise<void> {
    const { filters, page, mode, total, user, locale } = options
    const { search, categoryId, ...rest } = filters
    const active = this.activeFilters(rest)
    const query = this.normalizeQuery(search)
    if (page !== 1 || (!query && !categoryId && Object.keys(active).length === 0)) return

    await this.track({
      source: 'catalogue',
      query,
      filters: active,
      categoryId,
      mode: query ? mode : 'browse',
      resultsCount: total,
      userId: user?.id ?? null,
      organizationId: user?.currentOrganizationId ?? null,
      locale,
    })
  }

  /** Annuaire des fournisseurs : recherche par nom et/ou filtre pays, première page. */
  async trackSuppliers(options: {
    filters: SupplierDirectoryFilters
    page: number
    total: number
    user: User | null
    locale: string
  }): Promise<void> {
    const { filters, page, total, user, locale } = options
    const query = this.normalizeQuery(filters.search)
    if (page !== 1 || (!query && !filters.country)) return

    await this.track({
      source: 'suppliers',
      query,
      filters: filters.country ? { country: filters.country } : {},
      categoryId: null,
      mode: query ? 'keyword' : 'browse',
      resultsCount: total,
      userId: user?.id ?? null,
      organizationId: user?.currentOrganizationId ?? null,
      locale,
    })
  }

  /**
   * Sélecteur de produit d'une demande de devis (mots-clés). `results` : `null`
   * quand le moteur est indisponible.
   */
  async trackProductLookup(options: {
    search: string
    results: number | null
    user: User | null
    locale: string
  }): Promise<void> {
    const { search, results, user, locale } = options
    const query = this.normalizeQuery(search)
    if (!query) return

    await this.track({
      source: 'rfq_lookup',
      query,
      filters: {},
      categoryId: null,
      mode: results === null ? 'unavailable' : 'keyword',
      resultsCount: results ?? 0,
      userId: user?.id ?? null,
      organizationId: user?.currentOrganizationId ?? null,
      locale,
    })
  }

  async track(event: SearchEventPayload): Promise<void> {
    try {
      await RecordSearchEventJob.dispatch(event)
    } catch (error) {
      logger.warn({ err: error, source: event.source }, 'failed to queue search event')
    }
  }

  /** Ne garde que les filtres posés : tableaux non vides, booléens vrais, valeurs non nulles. */
  private activeFilters(filters: object): SearchEventFilters {
    const active: SearchEventFilters = {}
    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value) ? value.length > 0 : value !== false && value !== null) {
        active[key] = value
      }
    }
    return active
  }
}
