import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import searchConfig from '#config/search'
import ProductIndexService from '#services/product_index_service'
import { REFERENCE_QUERIES } from '#services/search/reference_queries'
import SearchEvaluationService from '#services/search/search_evaluation_service'
import { useDatabase } from '#tests/utils/setup'
import type { SearchEvaluationReport } from '#shared/types/search'

/**
 * Jeu de requêtes de référence (ADR 0002, décision 8) contre un **vrai**
 * Meilisearch : réindexe le seed `full`, rejoue chaque requête à travers le
 * chemin de recherche de l'application et vérifie le verdict.
 *
 * Nécessite `MEILISEARCH_HOST` (job CI `test-search`, ou `docker compose up -d`
 * en local) ; ignorée sinon, pour que `pnpm test` reste autonome. Les requêtes
 * sémantiques sont ignorées tant que la vectorisation est désactivée.
 */
const SKIP_REASON = 'MEILISEARCH_HOST absent : Meilisearch non joignable'

test.group('Recherche — jeu de référence (Meilisearch réel)', (group) => {
  useDatabase(group, { seed: 'full', perTest: false })

  let report: SearchEvaluationReport

  group.setup(async () => {
    if (!searchConfig.enabled) return
    const index = await app.container.make(ProductIndexService)
    await index.reindexAll()
    const evaluation = await app.container.make(SearchEvaluationService)
    report = await evaluation.evaluate()
  })

  for (const query of REFERENCE_QUERIES.filter((entry) => !entry.requiresEmbeddings)) {
    test(`${query.id} (${query.kind}) : « ${query.query} »`, ({ assert }) => {
      const result = report.results.find((entry) => entry.id === query.id)!

      assert.equal(
        result.status,
        'passed',
        `manque [${result.missing.join(', ')}], en trop [${result.unexpected.join(', ')}], reçu [${result.returned.join(', ')}]`
      )
    }).skip(!searchConfig.enabled, SKIP_REASON)
  }

  test('les requêtes sémantiques sont ignorées sans vecteurs', ({ assert }) => {
    const skipped = report.results.filter((entry) => entry.status === 'skipped')

    assert.sameMembers(
      skipped.map((entry) => entry.id),
      REFERENCE_QUERIES.filter((entry) => entry.requiresEmbeddings).map((entry) => entry.id)
    )
  }).skip(!searchConfig.enabled, SKIP_REASON)

  test('le rappel@10 des requêtes évaluées est complet', ({ assert }) => {
    assert.equal(report.recallAt10, 1)
    assert.equal(report.failed, 0)
  }).skip(!searchConfig.enabled, SKIP_REASON)
})
