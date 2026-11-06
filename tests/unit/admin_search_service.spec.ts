import { test } from '@japa/runner'
import AdminSearchService from '#services/admin_search_service'
import type { AdminSearchRunDbRow } from '#shared/types/admin_search'
import type { SearchEvaluationReport } from '#shared/types/search'

/** Présentation d'une ligne `search_runs` et synthèse d'une évaluation (#176), sans base. */
function row(overrides: Partial<AdminSearchRunDbRow> = {}): AdminSearchRunDbRow {
  return {
    id: 1,
    kind: 'reindex',
    status: 'running',
    supplier_id: null,
    supplier_name: null,
    processed: 25,
    total: 100,
    result: null,
    error: null,
    requested_by_email: 'admin@example.test',
    created_at: new Date('2026-11-06T10:00:00.000Z'),
    started_at: new Date('2026-11-06T10:00:01.000Z'),
    finished_at: null,
    ...overrides,
  }
}

test.group('AdminSearchService — présentation', () => {
  test('avancement en pourcentage, plafonné à 100', ({ assert }) => {
    assert.equal(AdminSearchService.present(row()).progress, 25)
    assert.equal(AdminSearchService.present(row({ processed: 130 })).progress, 100)
  })

  test('avancement inconnu tant que le total l’est, 100 % si le périmètre est vide', ({
    assert,
  }) => {
    assert.isNull(AdminSearchService.present(row({ total: null })).progress)
    assert.equal(AdminSearchService.present(row({ total: 0, processed: 0 })).progress, 100)
  })

  test('lit le nombre de produits indexés, jsonb déjà décodé ou en chaîne', ({ assert }) => {
    const done = row({ status: 'completed' })
    assert.equal(AdminSearchService.present({ ...done, result: { indexed: 12 } }).indexed, 12)
    assert.equal(
      AdminSearchService.present({ ...done, result: JSON.stringify({ indexed: 7 }) }).indexed,
      7
    )
    assert.isNull(AdminSearchService.present(done).indexed)
  })

  test('une évaluation porte sa synthèse, pas un nombre de produits indexés', ({ assert }) => {
    const summary = { recallAt10: 0.8, passed: 4, failed: 1, skipped: 0, failures: [] }

    const run = AdminSearchService.present(
      row({ kind: 'evaluation', status: 'completed', result: summary })
    )

    assert.deepEqual(run.evaluation, summary)
    assert.isNull(run.indexed)
  })

  test('dates en ISO, auteur conservé', ({ assert }) => {
    const run = AdminSearchService.present(row())

    assert.equal(run.createdAt, '2026-11-06T10:00:00.000Z')
    assert.equal(run.startedAt, '2026-11-06T10:00:01.000Z')
    assert.isNull(run.finishedAt)
    assert.equal(run.requestedBy, 'admin@example.test')
  })
})

test.group('AdminSearchService — synthèse d’évaluation', () => {
  test('ne garde que les requêtes en échec', ({ assert }) => {
    const report: SearchEvaluationReport = {
      results: [
        {
          id: 'ok',
          kind: 'keyword',
          query: 'stylo',
          status: 'passed',
          recallAt10: 1,
          returned: ['a'],
          missing: [],
          unexpected: [],
          latencyMs: 5,
        },
        {
          id: 'ko',
          kind: 'keyword',
          query: 'mug',
          status: 'failed',
          recallAt10: 0,
          returned: [],
          missing: ['mug-blanc'],
          unexpected: [],
          latencyMs: 7,
        },
        {
          id: 'skip',
          kind: 'semantic',
          query: 'cadeau',
          status: 'skipped',
          recallAt10: 0,
          returned: [],
          missing: [],
          unexpected: [],
          latencyMs: 0,
        },
      ],
      recallAt10: 0.5,
      passed: 1,
      failed: 1,
      skipped: 1,
      latencyP50Ms: 5,
      latencyP95Ms: 7,
    }

    const summary = AdminSearchService.summarize(report)

    assert.notProperty(summary, 'results')
    assert.equal(summary.recallAt10, 0.5)
    assert.deepEqual(summary.failures, [
      { id: 'ko', query: 'mug', missing: ['mug-blanc'], unexpected: [] },
    ])
  })
})
