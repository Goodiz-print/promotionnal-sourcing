import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { AdminConsentRow } from '#shared/types/admin_consent'

const translations = {
  'admin.consents.title': 'Consentements légaux',
  'admin.consents.subtitle': 'Version {version}',
  'admin.consents.empty': 'Aucun consentement.',
  'admin.consents.export': 'Exporter la preuve',
  'admin.consents.active': 'Actif',
  'admin.consents.revoked': 'Retiré',
  'admin.consents.outdated': 'Version dépassée',
  'admin.consents.kinds.terms': 'CGU',
  'admin.consents.kinds.data_license': 'Licence de données',
}

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    useForm: m.makeUseForm(),
    router: { get: vi.fn() },
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({
  urlFor: (name: string, params: { id?: number }) =>
    `/fr/${name}${params.id ? `/${params.id}` : ''}`,
}))

vi.mock('@adonisjs/inertia/vue', async () => {
  const { LinkStub } = await import('./support/inertia_mocks')
  return { Link: LinkStub }
})

import ConsentsIndex from '~/pages/admin/consents/index.vue'

function row(overrides: Partial<AdminConsentRow> = {}): AdminConsentRow {
  return {
    id: 1,
    kind: 'terms',
    version: '2026-10-19',
    acceptedAt: '2026-10-20T10:00:00.000Z',
    revokedAt: null,
    ipAddress: '198.51.100.4',
    organization: { id: 7, name: 'Acme' },
    user: { id: 3, email: 'jane@acme.test' },
    outdated: false,
    ...overrides,
  }
}

function mountPage(rows: AdminConsentRow[]) {
  return mount(ConsentsIndex, {
    props: {
      consents: {
        data: rows,
        meta: { total: rows.length, perPage: 50, currentPage: 1, lastPage: 1 },
      },
      overview: { currentVersion: '2026-10-19', outdatedCount: 0 },
      filters: { organization: null, user: null, kind: null, version: null, outdated: false },
    },
  })
}

describe('Consentements — page admin', () => {
  beforeEach(() => vi.clearAllMocks())

  it('affiche la preuve et un lien d’export par organisation', () => {
    const wrapper = mountPage([row()])

    expect(wrapper.text()).toContain('Acme')
    expect(wrapper.text()).toContain('jane@acme.test')
    expect(wrapper.text()).toContain('198.51.100.4')
    const link = wrapper.find('a[href*="consents.export"]')
    expect(link.attributes('href')).toContain('organizationId=7')
  })

  it('distingue consentement actif, dépassé et retiré', () => {
    const wrapper = mountPage([
      row({ id: 1 }),
      row({ id: 2, outdated: true, version: '2025-01-01' }),
      row({ id: 3, revokedAt: '2026-10-25T10:00:00.000Z' }),
    ])

    const text = wrapper.text()
    expect(text).toContain('Actif')
    expect(text).toContain('Version dépassée')
    expect(text).toContain('Retiré')
  })

  it('affiche l’état vide sans résultat', () => {
    expect(mountPage([]).text()).toContain('Aucun consentement.')
  })
})
