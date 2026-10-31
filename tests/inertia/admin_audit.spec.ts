import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { AdminAuditFilters, AdminAuditLogItem } from '#shared/types/admin_audit'

const translations = {
  'admin.audit.title': 'Journal d’audit',
  'admin.audit.subtitle': 'Historique.',
  'admin.audit.empty': 'Aucune entrée.',
  'admin.audit.system': 'Système',
  'admin.audit.viaCli': 'Via la ligne de commande',
  'admin.audit.becomes': 'devient',
  'admin.audit.actions.platform_role.changed': 'Rôle plateforme modifié',
  'admin.audit.actions.category.created': 'Catégorie créée',
  'admin.audit.actions.category.updated': 'Catégorie modifiée',
  'admin.audit.actions.category.deleted': 'Catégorie supprimée',
  'admin.audit.targets.user': 'Utilisateur',
  'admin.audit.targets.category': 'Catégorie',
  'admin.audit.filters.action': 'Action',
  'admin.audit.filters.target': 'Cible',
  'admin.audit.filters.all': 'Toutes',
  'admin.pagination.previous': 'Précédent',
  'admin.pagination.next': 'Suivant',
}

const get = vi.fn()

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    router: { get: (...args: unknown[]) => get(...args) },
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({ urlFor: () => '/fr/admin/audit' }))
vi.mock('@adonisjs/inertia/vue', async () => {
  const { LinkStub } = await import('./support/inertia_mocks')
  return { Link: LinkStub }
})

const { default: Index } = await import('~/pages/admin/audit/index.vue')

const NO_FILTERS: AdminAuditFilters = {
  action: null,
  targetType: null,
  actor: null,
  from: null,
  to: null,
}

function entry(id: number, extra: Partial<AdminAuditLogItem> = {}): AdminAuditLogItem {
  return {
    id,
    action: 'platform_role.changed',
    actorEmail: 'admin@example.com',
    targetType: 'user',
    targetId: 7,
    changes: { before: { platformRole: 'none' }, after: { platformRole: 'moderator' } },
    ipAddress: '127.0.0.1',
    createdAt: '2026-10-31T10:00:00.000Z',
    ...extra,
  }
}

function render(entries: AdminAuditLogItem[], lastPage = 1) {
  return mount(Index, {
    props: {
      entries: {
        data: entries,
        meta: { total: entries.length, perPage: 50, currentPage: 1, lastPage },
      },
      filters: NO_FILTERS,
    },
  })
}

describe('admin/audit/index', () => {
  beforeEach(() => get.mockClear())

  it('affiche l’action, l’acteur, la cible et le détail avant → après', () => {
    const row = render([entry(1)]).find('tbody tr')

    expect(row.text()).toContain('Rôle plateforme modifié')
    expect(row.text()).toContain('admin@example.com')
    expect(row.text()).toContain('Utilisateur #7')
    const change = row.find('li')
    expect(change.text()).toContain('platformRole:')
    expect(change.text()).toContain('none')
    expect(change.text()).toContain('devient')
    expect(change.text()).toContain('moderator')
  })

  it('marque une action lancée en ligne de commande, sans acteur', () => {
    const row = render([
      entry(1, { actorEmail: null, changes: { after: { platformRole: 'admin' }, source: 'cli' } }),
    ]).find('tbody tr')

    expect(row.text()).toContain('Système')
    expect(row.text()).toContain('Via la ligne de commande')
  })

  it('affiche l’état vide sans tableau', () => {
    const wrapper = render([])

    expect(wrapper.text()).toContain('Aucune entrée.')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('choisir une action relance la visite avec ce filtre, à la page 1', async () => {
    const wrapper = render([entry(1)])

    await wrapper.find('#audit-action').setValue('category.created')

    expect(get).toHaveBeenCalledWith(
      '/fr/admin/audit',
      expect.objectContaining({ action: 'category.created', page: 1 }),
      expect.objectContaining({ only: ['entries', 'filters'] })
    )
  })
})
