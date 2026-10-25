import { test } from '@japa/runner'
import { REFERENCE_QUERIES } from '#services/search/reference_queries'
import SearchEvaluationService from '#services/search/search_evaluation_service'
import { REFERENCE_QUERY_KINDS, type ReferenceQuery } from '#shared/types/search'

const EXACT: ReferenceQuery = {
  id: 'q',
  kind: 'criteria',
  query: 'crayon',
  expected: ['a', 'b'],
  exact: true,
}

test.group('Jeu de référence — verdict', () => {
  test('exact : ni plus ni moins que les fiches attendues', ({ assert }) => {
    assert.equal(SearchEvaluationService.judge(EXACT, ['b', 'a']).status, 'passed')

    const extra = SearchEvaluationService.judge(EXACT, ['a', 'b', 'c'])
    assert.equal(extra.status, 'failed')
    assert.deepEqual(extra.unexpected, ['c'])

    const missing = SearchEvaluationService.judge(EXACT, ['a'])
    assert.equal(missing.status, 'failed')
    assert.deepEqual(missing.missing, ['b'])
    assert.equal(missing.recallAt10, 0.5)
  })

  test('non exact : seul le rappel dans les 10 premières compte', ({ assert }) => {
    const query = { ...EXACT, exact: false }

    assert.equal(SearchEvaluationService.judge(query, ['c', 'a', 'b']).status, 'passed')

    const late = [...Array.from({ length: 10 }, (_, index) => `x${index}`), 'a', 'b']
    assert.equal(SearchEvaluationService.judge(query, late).status, 'failed')
  })

  test('un ET sans résultat attendu réussit seulement s’il ne renvoie rien', ({ assert }) => {
    const empty: ReferenceQuery = { ...EXACT, expected: [] }

    const clean = SearchEvaluationService.judge(empty, [])
    assert.equal(clean.status, 'passed')
    assert.equal(clean.recallAt10, 1)
    assert.equal(SearchEvaluationService.judge(empty, ['a']).status, 'failed')
  })

  test('la synthèse ignore les requêtes passées et calcule p50 / p95', ({ assert }) => {
    const result = (
      latencyMs: number,
      status: 'passed' | 'failed' | 'skipped',
      recall: number
    ) => ({
      id: 'r',
      kind: 'keyword' as const,
      query: 'x',
      status,
      recallAt10: recall,
      returned: [],
      missing: [],
      unexpected: [],
      latencyMs,
    })

    const report = SearchEvaluationService.summarize([
      result(10, 'passed', 1),
      result(30, 'failed', 0.5),
      result(0, 'skipped', 0),
      result(20, 'passed', 1),
    ])

    assert.equal(report.passed, 2)
    assert.equal(report.failed, 1)
    assert.equal(report.skipped, 1)
    assert.closeTo(report.recallAt10, (1 + 0.5 + 1) / 3, 1e-9)
    assert.equal(report.latencyP50Ms, 20)
    assert.equal(report.latencyP95Ms, 30)
    assert.equal(SearchEvaluationService.percentile([], 0.95), 0)
  })

  test('les requêtes de référence sont bien formées', ({ assert }) => {
    const ids = REFERENCE_QUERIES.map((query) => query.id)

    assert.equal(new Set(ids).size, ids.length, 'ids uniques')
    for (const query of REFERENCE_QUERIES) {
      assert.include(REFERENCE_QUERY_KINDS, query.kind)
      assert.isNotEmpty(query.query)
    }
    // Chaque famille du pipeline est éprouvée.
    assert.sameMembers(
      [...new Set(REFERENCE_QUERIES.map((query) => query.kind))],
      [...REFERENCE_QUERY_KINDS]
    )
  })
})
