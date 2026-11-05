import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { AdminImportDetail, AdminImportRow } from '#shared/types/admin_import'

const translations = {
  'admin.imports.title': 'Imports',
  'admin.imports.empty': 'Aucun import.',
  'admin.imports.retry': "Relancer l'import",
  'admin.imports.exportErrors': 'Exporter les erreurs (CSV)',
  'admin.imports.statuses.failed': 'Échec',
  'admin.imports.statuses.completed': 'Terminé',
  'admin.imports.kinds.products_csv': 'Produits (CSV)',
  'admin.imports.progress': '{done} / {total} lignes',
  'admin.imports.noErrors': 'Aucune erreur enregistrée.',
  'admin.imports.wholeFile': 'Fichier entier',
  'admin.imports.showTitle': 'Import n° {id}',
  'admin.imports.retriedBy': "Relancé par l'import",
  'admin.imports.engineNotice': "Le moteur d'import n'est pas encore branché.",
}

const post = vi.hoisted(() => vi.fn())
vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    useForm: m.makeUseForm({ post }),
    router: { get: vi.fn(), post },
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({
  urlFor: (name: string, params: Record<string, unknown> = {}) =>
    `/fr/${name}${params.id ? `/${params.id}` : ''}`,
}))
vi.mock('@adonisjs/inertia/vue', async () => {
  const { LinkStub } = await import('./support/inertia_mocks')
  return { Link: LinkStub }
})

import ImportsIndex from '~/pages/admin/imports/index.vue'
import ImportsShow from '~/pages/admin/imports/show.vue'

function row(overrides: Partial<AdminImportRow> = {}): AdminImportRow {
  return {
    id: 7,
    kind: 'products_csv',
    status: 'completed',
    totalRows: 10,
    processedRows: 10,
    errorCount: 0,
    organization: { id: 3, name: 'Acme Goodies' },
    createdBy: 'ops@example.test',
    retryOfId: null,
    retriedById: null,
    retryable: false,
    startedAt: '2026-11-05T10:00:00.000Z',
    finishedAt: '2026-11-05T10:05:00.000Z',
    createdAt: '2026-11-05T09:59:00.000Z',
    ...overrides,
  }
}

function detail(overrides: Partial<AdminImportDetail> = {}): AdminImportDetail {
  return { ...row(), errors: [], hasSourceFile: false, ...overrides }
}

function mountIndex(rows: AdminImportRow[]) {
  return mount(ImportsIndex, {
    props: {
      imports: {
        data: rows,
        meta: { total: rows.length, perPage: 25, currentPage: 1, lastPage: 1 },
      },
      filters: { status: null, kind: null, organization: null },
      statuses: ['pending', 'running', 'completed', 'failed'],
      kinds: ['products_csv', 'suppliers_csv'],
    },
  })
}

describe('Imports — liste', () => {
  it('affiche l’organisation, le type, le statut et la progression', () => {
    const text = mountIndex([row()]).text()

    expect(text).toContain('Acme Goodies')
    expect(text).toContain('Produits (CSV)')
    expect(text).toContain('Terminé')
    expect(text).toContain('10 / 10 lignes')
  })

  it('affiche l’état vide', () => {
    expect(mountIndex([]).text()).toContain('Aucun import.')
  })
})

describe('Imports — fiche', () => {
  beforeEach(() => vi.clearAllMocks())

  it('propose de relancer et d’exporter les erreurs d’un import échoué', async () => {
    const wrapper = mount(ImportsShow, {
      props: {
        importJob: detail({
          status: 'failed',
          retryable: true,
          errorCount: 1,
          errors: [{ row: 0, message: 'Fichier illisible', column: null, receivedValue: null }],
        }),
      },
    })

    expect(wrapper.text()).toContain('Fichier illisible')
    expect(wrapper.text()).toContain('Fichier entier')
    expect(wrapper.text()).toContain('Exporter les erreurs (CSV)')

    const retry = wrapper.findAll('button').find((b) => b.text() === "Relancer l'import")
    await retry!.trigger('click')
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('prévient que le moteur d’import n’est pas branché avant de relancer', () => {
    const retryable = mount(ImportsShow, {
      props: { importJob: detail({ status: 'failed', retryable: true }) },
    })
    expect(retryable.text()).toContain("Le moteur d'import n'est pas encore branché.")

    const completed = mount(ImportsShow, { props: { importJob: detail() } })
    expect(completed.text()).not.toContain("Le moteur d'import")
  })

  it('ne propose rien sur un import terminé sans erreur', () => {
    const wrapper = mount(ImportsShow, { props: { importJob: detail() } })

    expect(wrapper.text()).toContain('Aucune erreur enregistrée.')
    expect(wrapper.text()).not.toContain("Relancer l'import")
    expect(wrapper.text()).not.toContain('Exporter les erreurs (CSV)')
  })

  it('renvoie vers l’import qui remplace celui-ci', () => {
    const wrapper = mount(ImportsShow, {
      props: { importJob: detail({ status: 'failed', retriedById: 9 }) },
    })

    expect(wrapper.text()).toContain('#9')
  })
})
