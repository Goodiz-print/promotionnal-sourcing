import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { answerConfirm, confirmText, mountConfirmHost } from './support/confirm_dialog'
import type {
  AdminSearchDrift,
  AdminSearchRun,
  AdminSearchStatus,
} from '#shared/types/admin_search'

const translations = {
  'admin.search.status.title': 'Moteur de recherche',
  'admin.search.status.ok': 'Meilisearch répond et l’index est présent.',
  'admin.search.status.disabled': 'La recherche est désactivée',
  'admin.search.status.unreachable': 'Meilisearch est injoignable',
  'admin.search.status.missingIndex': 'L’index n’existe pas encore',
  'admin.search.status.index': 'Index',
  'admin.search.status.documents': 'Documents',
  'admin.search.status.indexing': 'Écritures en cours',
  'admin.search.status.embedder': 'Vectorisation',
  'admin.search.status.semanticRatio': 'Poids du sémantique',
  'admin.search.status.noIndex': 'Aucun index',
  'admin.search.status.embedderOff': 'Désactivée',
  'admin.search.status.yes': 'Oui',
  'admin.search.status.no': 'Non',
  'admin.search.tasks.title': 'Dernières tâches Meilisearch',
  'admin.search.tasks.uid': 'Tâche',
  'admin.search.tasks.type': 'Type',
  'admin.search.tasks.status': 'État',
  'admin.search.tasks.date': 'Date',
  'admin.search.tasks.error': 'Erreur',
  'admin.search.drift.title': 'Écart',
  'admin.search.drift.hint': 'Compare',
  'admin.search.drift.check': 'Vérifier l’écart',
  'admin.search.drift.unavailable.disabled': 'Comparaison impossible : recherche désactivée',
  'admin.search.drift.unavailable.failed': 'La comparaison a échoué',
  'admin.search.drift.inSync': 'L’index correspond à PostgreSQL.',
  'admin.search.drift.outOfSync': 'L’index diverge de PostgreSQL',
  'admin.search.drift.checkedAt': 'Vérifié le {date}',
  'admin.search.drift.expected': 'Attendus',
  'admin.search.drift.indexed': 'Dans l’index',
  'admin.search.drift.missing': 'Manquants',
  'admin.search.drift.extra': 'En trop',
  'admin.search.drift.sample': 'Ex. : {ids}',
  'admin.search.reindex.title': 'Réindexation',
  'admin.search.reindex.hint': 'Reconstruit',
  'admin.search.reindex.supplier': 'Identifiant du fournisseur',
  'admin.search.reindex.supplierHint': 'Choisissez un fournisseur',
  'admin.search.reindex.allSuppliers': 'Tout le catalogue',
  'admin.search.reindex.submit': 'Réindexer tout le catalogue',
  'admin.search.reindex.submitSupplier': 'Réindexer ce fournisseur',
  'admin.search.reindex.confirm': 'Tout reconstruire ?',
  'admin.search.reindex.confirmSupplier': 'Réindexer ce fournisseur ?',
  'admin.search.reindex.history': 'Historique des réindexations',
  'admin.search.evaluation.history': 'Historique des évaluations',
  'admin.search.runs.empty': 'Aucune opération',
  'admin.search.runs.emptyDescription': 'Elles apparaissent ici',
  'admin.search.runs.date': 'Demandée le',
  'admin.search.runs.status': 'État',
  'admin.search.runs.scope': 'Périmètre',
  'admin.search.runs.progress': 'Avancement',
  'admin.search.runs.recall': 'Rappel@10',
  'admin.search.runs.results': 'Requêtes',
  'admin.search.runs.latency': 'Latence',
  'admin.search.runs.requestedBy': 'Demandée par',
  'admin.search.runs.all': 'Tout le catalogue',
  'admin.search.runs.supplier': '{name} (n° {id})',
  'admin.search.runs.indexed': '{count} produits indexés',
  'admin.search.runs.processed': '{done} / {total} produits parcourus',
  'admin.search.runs.counts': '{passed} réussie(s), {failed} en échec, {skipped} ignorée(s)',
  'admin.search.runs.latencies': 'p50 {p50} ms · p95 {p95} ms',
  'admin.search.runs.missing': 'manque',
  'admin.search.runs.statuses.pending': 'En attente',
  'admin.search.runs.statuses.running': 'En cours',
  'admin.search.runs.statuses.completed': 'Terminée',
  'admin.search.runs.statuses.failed': 'Échouée',
  'admin.search.runs.statuses.interrupted': 'Interrompue',
}

const post = vi.hoisted(() => vi.fn())
const reload = vi.hoisted(() => vi.fn())
vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    router: { get: vi.fn(), post, reload },
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({
  urlFor: (name: string) => `/fr/${name}`,
}))

import SearchDrift from '~/components/admin/search/search_drift.vue'
import SearchReindexForm from '~/components/admin/search/search_reindex_form.vue'
import SearchRuns from '~/components/admin/search/search_runs.vue'
import SearchStatus from '~/components/admin/search/search_status.vue'

function status(overrides: Partial<AdminSearchStatus> = {}): AdminSearchStatus {
  return {
    state: 'ready',
    index: 'products_test',
    embedder: { enabled: true, provider: 'huggingface', model: 'bge-m3' },
    semanticRatio: 0.5,
    info: { indexExists: true, documents: 42, indexing: false, tasks: [] },
    error: null,
    ...overrides,
  }
}

function run(overrides: Partial<AdminSearchRun> = {}): AdminSearchRun {
  return {
    id: 1,
    kind: 'reindex',
    status: 'running',
    supplierId: null,
    supplierName: null,
    processed: 25,
    total: 100,
    progress: 25,
    evaluation: null,
    indexed: null,
    stale: false,
    error: null,
    requestedBy: 'admin@example.test',
    createdAt: '2026-11-06T10:00:00.000Z',
    startedAt: '2026-11-06T10:00:01.000Z',
    finishedAt: null,
    ...overrides,
  }
}

function drift(overrides: Partial<AdminSearchDrift> = {}): AdminSearchDrift {
  return {
    expected: 10,
    indexed: 10,
    missing: [],
    missingCount: 0,
    extra: [],
    extraCount: 0,
    checkedAt: '2026-11-06T10:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Recherche — état du moteur', () => {
  it('moteur sain : chiffres de l’index', () => {
    const text = mount(SearchStatus, { props: { status: status() } }).text()

    expect(text).toContain('Meilisearch répond')
    expect(text).toContain('products_test')
    expect(text).toContain('42')
    expect(text).toContain('bge-m3')
  })

  it('moteur inerte : alerte « désactivée »', () => {
    const text = mount(SearchStatus, {
      props: { status: status({ state: 'disabled', info: null }) },
    }).text()

    expect(text).toContain('La recherche est désactivée')
    expect(text).not.toContain('Meilisearch répond')
  })

  it('moteur injoignable : alerte avec le message du moteur', () => {
    const text = mount(SearchStatus, {
      props: { status: status({ state: 'unreachable', info: null, error: 'fetch failed' }) },
    }).text()

    expect(text).toContain('Meilisearch est injoignable')
    expect(text).toContain('fetch failed')
  })

  it('index absent : invite à réindexer', () => {
    const text = mount(SearchStatus, {
      props: {
        status: status({ info: { indexExists: false, documents: 0, indexing: false, tasks: [] } }),
      },
    }).text()

    expect(text).toContain('L’index n’existe pas encore')
    expect(text).toContain('Aucun index')
  })

  it('liste les tâches récentes avec leur erreur', () => {
    const text = mount(SearchStatus, {
      props: {
        status: status({
          info: {
            indexExists: true,
            documents: 1,
            indexing: false,
            tasks: [
              {
                uid: 9,
                type: 'documentAdditionOrUpdate',
                status: 'failed',
                enqueuedAt: null,
                finishedAt: '2026-11-06T10:00:01.000Z',
                error: 'boom',
              },
            ],
          },
        }),
      },
    }).text()

    expect(text).toContain('documentAdditionOrUpdate')
    expect(text).toContain('boom')
  })
})

describe('Recherche — écart', () => {
  it('demande le calcul à la demande par un rechargement partiel', async () => {
    const wrapper = mount(SearchDrift, { props: { available: true } })

    await wrapper.find('button').trigger('click')

    expect(reload).toHaveBeenCalledWith(expect.objectContaining({ only: ['drift'] }))
  })

  it('bouton inactif quand le moteur n’est pas joignable', () => {
    const wrapper = mount(SearchDrift, { props: { available: false } })

    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('index aligné', () => {
    const text = mount(SearchDrift, { props: { available: true, drift: drift() } }).text()

    expect(text).toContain('L’index correspond à PostgreSQL.')
  })

  it('écart : compteurs et échantillons', () => {
    const text = mount(SearchDrift, {
      props: {
        available: true,
        drift: drift({ missing: [3, 4], missingCount: 2, extra: [99], extraCount: 1 }),
      },
    }).text()

    expect(text).toContain('L’index diverge de PostgreSQL')
    expect(text).toContain('Ex. : 3, 4')
    expect(text).toContain('Ex. : 99')
  })

  it('écart non calculable : dit si la recherche est désactivée ou si le moteur a échoué', () => {
    const disabled = mount(SearchDrift, {
      props: { available: true, drift: { unavailable: 'disabled' } },
    }).text()
    const failed = mount(SearchDrift, {
      props: { available: true, drift: { unavailable: 'failed' } },
    }).text()

    expect(disabled).toContain('recherche désactivée')
    expect(failed).toContain('La comparaison a échoué')
  })
})

const suppliers = [
  { id: 5, name: 'Acme' },
  { id: 9, name: 'Bureau Plus' },
]

describe('Recherche — réindexation', () => {
  it('lance la réindexation complète après confirmation', async () => {
    const host = await mountConfirmHost()
    const wrapper = mount(SearchReindexForm, { props: { enabled: true, busy: false, suppliers } })

    await wrapper.find('form').trigger('submit')
    expect(confirmText(host)).toBe('Tout reconstruire ?')
    expect(confirmText(host, 'confirm')).toBe('Réindexer tout le catalogue')
    await answerConfirm(host, 'confirm')

    expect(post).toHaveBeenCalledWith('/fr/admin.search.reindex', {}, expect.any(Object))
  })

  it('propose les fournisseurs et cible celui qui est choisi', async () => {
    const host = await mountConfirmHost()
    const wrapper = mount(SearchReindexForm, { props: { enabled: true, busy: false, suppliers } })

    expect(wrapper.text()).toContain('Bureau Plus')
    await wrapper.find('select').setValue('9')
    await wrapper.find('form').trigger('submit')
    expect(confirmText(host)).toBe('Réindexer ce fournisseur ?')
    await answerConfirm(host, 'confirm')

    expect(wrapper.text()).toContain('Réindexer ce fournisseur')
    expect(post).toHaveBeenCalledWith(
      '/fr/admin.search.reindex',
      { supplierId: 9 },
      expect.any(Object)
    )
  })

  it('n’envoie rien sans confirmation', async () => {
    const host = await mountConfirmHost()
    const wrapper = mount(SearchReindexForm, { props: { enabled: true, busy: false, suppliers } })

    await wrapper.find('form').trigger('submit')
    await answerConfirm(host, 'cancel')

    expect(post).not.toHaveBeenCalled()
  })

  it('bouton inactif tant qu’une réindexation est en cours', () => {
    const wrapper = mount(SearchReindexForm, { props: { enabled: true, busy: true, suppliers } })

    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })
})

describe('Recherche — historique', () => {
  it('réindexation en cours : barre et produits parcourus', () => {
    const wrapper = mount(SearchRuns, { props: { kind: 'reindex', runs: [run()] } })

    expect(wrapper.text()).toContain('En cours')
    expect(wrapper.text()).toContain('25 / 100 produits parcourus')
    expect(wrapper.find('[role="progressbar"]').attributes('aria-valuenow')).toBe('25')
  })

  it('réindexation terminée : produits indexés ; fournisseur nommé', () => {
    const wrapper = mount(SearchRuns, {
      props: {
        kind: 'reindex',
        runs: [
          run({
            status: 'completed',
            progress: 100,
            indexed: 98,
            supplierId: 5,
            supplierName: 'Acme',
          }),
        ],
      },
    })

    expect(wrapper.text()).toContain('98 produits indexés')
    expect(wrapper.text()).toContain('Acme (n° 5)')
  })

  it('opération perdue : affichée comme interrompue, pas « en cours »', () => {
    const text = mount(SearchRuns, {
      props: { kind: 'reindex', runs: [run({ stale: true })] },
    }).text()

    expect(text).toContain('Interrompue')
    expect(text).not.toContain('En cours')
  })

  it('échec : message d’erreur visible', () => {
    const wrapper = mount(SearchRuns, {
      props: { kind: 'reindex', runs: [run({ status: 'failed', error: 'boom' })] },
    })

    expect(wrapper.text()).toContain('Échouée')
    expect(wrapper.text()).toContain('boom')
  })

  it('évaluation : rappel, résultats, latences et requêtes en échec', () => {
    const wrapper = mount(SearchRuns, {
      props: {
        kind: 'evaluation',
        runs: [
          run({
            kind: 'evaluation',
            status: 'completed',
            evaluation: {
              recallAt10: 0.75,
              passed: 3,
              failed: 1,
              skipped: 0,
              latencyP50Ms: 12.4,
              latencyP95Ms: 30.2,
              failures: [{ id: 'q2', query: 'mug', missing: ['mug-blanc'], unexpected: [] }],
            },
          }),
        ],
      },
    })

    const text = wrapper.text()
    expect(text).toContain('0.75')
    expect(text).toContain('3 réussie(s), 1 en échec, 0 ignorée(s)')
    expect(text).toContain('p50 12 ms · p95 30 ms')
    expect(text).toContain('q2')
    expect(text).toContain('mug-blanc')
  })

  it('aucune opération : état vide', () => {
    const text = mount(SearchRuns, { props: { kind: 'reindex', runs: [] } }).text()

    expect(text).toContain('Aucune opération')
  })
})
