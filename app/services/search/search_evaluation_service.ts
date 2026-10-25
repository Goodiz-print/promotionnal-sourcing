import { inject } from '@adonisjs/core'
import searchConfig from '#config/search'
import AttributeValue from '#models/attribute_value'
import Category from '#models/category'
import ProductSearchService from '#services/product_search_service'
import { REFERENCE_QUERIES } from '#services/search/reference_queries'
import type {
  ReferenceQuery,
  ReferenceQueryResult,
  SearchEvaluationReport,
} from '#shared/types/search'

/** Nombre de résultats pris en compte pour le rappel. */
const RANK_CUTOFF = 10

/**
 * Rejoue le jeu de requêtes de référence (ADR 0002, décision 8) à travers le
 * **vrai** chemin de recherche de l'application (`ProductSearchService`) : ce
 * qu'on mesure est ce que verrait un acheteur, rechargement PostgreSQL compris.
 *
 * Sert à choisir le modèle d'embeddings, le ratio sémantique et la quantification
 * par la mesure, et à détecter une régression quand le pipeline change.
 */
@inject()
export default class SearchEvaluationService {
  constructor(private search: ProductSearchService) {}

  async evaluate(queries: ReferenceQuery[] = REFERENCE_QUERIES): Promise<SearchEvaluationReport> {
    const results: ReferenceQueryResult[] = []
    for (const query of queries) results.push(await this.run(query))
    return SearchEvaluationService.summarize(results)
  }

  /** Synthèse d'une série de résultats (rappel moyen, latences p50 / p95). */
  static summarize(results: ReferenceQueryResult[]): SearchEvaluationReport {
    const evaluated = results.filter((result) => result.status !== 'skipped')
    const latencies = evaluated.map((result) => result.latencyMs).sort((a, b) => a - b)
    const mean = evaluated.reduce((sum, result) => sum + result.recallAt10, 0)

    return {
      results,
      recallAt10: evaluated.length > 0 ? mean / evaluated.length : 0,
      passed: results.filter((result) => result.status === 'passed').length,
      failed: results.filter((result) => result.status === 'failed').length,
      skipped: results.filter((result) => result.status === 'skipped').length,
      latencyP50Ms: SearchEvaluationService.percentile(latencies, 0.5),
      latencyP95Ms: SearchEvaluationService.percentile(latencies, 0.95),
    }
  }

  /** Percentile « rang le plus proche » d'une série triée ; 0 si vide. */
  static percentile(sorted: number[], fraction: number): number {
    if (sorted.length === 0) return 0
    const rank = Math.ceil(fraction * sorted.length) - 1
    return sorted[Math.min(Math.max(rank, 0), sorted.length - 1)]
  }

  /** Verdict d'une requête à partir de ce que la recherche a renvoyé. */
  static judge(
    query: ReferenceQuery,
    returned: string[]
  ): Pick<ReferenceQueryResult, 'status' | 'recallAt10' | 'missing' | 'unexpected'> {
    const top = returned.slice(0, query.rank ?? RANK_CUTOFF)
    const missing = query.expected.filter((slug) => !top.includes(slug))
    const unexpected = returned.filter((slug) => !query.expected.includes(slug))
    const recallAt10 =
      query.expected.length === 0
        ? 1
        : (query.expected.length - missing.length) / query.expected.length
    const passed = missing.length === 0 && (!query.exact || unexpected.length === 0)

    return { status: passed ? 'passed' : 'failed', recallAt10, missing, unexpected }
  }

  private async run(query: ReferenceQuery): Promise<ReferenceQueryResult> {
    const base = { id: query.id, kind: query.kind, query: query.query }

    if (query.requiresEmbeddings && !searchConfig.embedder.enabled) {
      return {
        ...base,
        status: 'skipped',
        recallAt10: 0,
        returned: [],
        missing: [],
        unexpected: [],
        latencyMs: 0,
      }
    }

    const startedAt = performance.now()
    const page = await this.search.search({
      search: query.query,
      categoryId: await this.categoryId(query.category),
      madeInEurope: query.madeInEurope ?? false,
      attributeValueIds: await this.attributeValueIds(query.attributes ?? []),
      originZones: [],
      newOnly: false,
      page: 1,
      perPage: RANK_CUTOFF,
    })
    const latencyMs = performance.now() - startedAt

    // `null` : le moteur n'a pas répondu (inerte ou injoignable). Une évaluation
    // qui retomberait sur PostgreSQL ne mesurerait pas le pipeline Meilisearch.
    if (!page) throw new Error('Meilisearch unavailable: nothing to evaluate')

    const returned = page.all().map((product) => product.slug)
    return { ...base, ...SearchEvaluationService.judge(query, returned), returned, latencyMs }
  }

  private async categoryId(slug: string | undefined): Promise<number | null> {
    if (!slug) return null
    const category = await Category.findByOrFail('slug', slug)
    return category.id
  }

  private async attributeValueIds(slugs: string[]): Promise<number[]> {
    if (slugs.length === 0) return []
    const values = await AttributeValue.query().whereIn('slug', slugs)
    return values.map((value) => value.id)
  }
}
