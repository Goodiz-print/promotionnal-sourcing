import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type {
  HealthComponentState,
  PlatformHealthReport,
  PlatformHealthSummary,
} from '#shared/types/admin_health'

const translations = {
  'admin.health.statuses.ok': 'Sain',
  'admin.health.statuses.degraded': 'Dégradé',
  'admin.health.statuses.down': 'En panne',
  'admin.health.statuses.disabled': 'Non configuré',
  'admin.health.overall.ok': 'Tout répond.',
  'admin.health.overall.degraded': 'Un composant est dégradé.',
  'admin.health.overall.down': 'Un composant est en panne.',
  'admin.health.names.database': 'Base de données',
  'admin.health.names.storage': 'Stockage',
  'admin.health.names.search': 'Recherche',
  'admin.health.hints.database': 'Requête de test.',
  'admin.health.hints.storage': 'HEAD sur Cellar.',
  'admin.health.hints.search': 'Moteur.',
  'admin.health.components.title': 'Composants',
  'admin.health.components.checkedAt': 'Sondé le {date}',
  'admin.health.columns.component': 'Composant',
  'admin.health.columns.status': 'Statut',
  'admin.health.columns.latency': 'Durée',
  'admin.health.columns.detail': 'Détail',
  'admin.health.columns.since': 'Depuis',
  'admin.health.columns.alert': 'Alerte',
  'admin.health.ms': '{count} ms',
  'admin.health.alerted': 'Envoyée',
  'admin.health.notAlerted': '—',
  'admin.health.summary.title': 'Santé de la plateforme',
  'admin.health.summary.empty': 'La surveillance n’a pas encore tourné.',
  'admin.health.summary.details': 'Voir le détail',
  'admin.health.summary.stale': 'Les états sont périmés : la surveillance ne tourne plus.',
}

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return { usePage: () => m.inertiaPage(translations), Head: m.HeadStub }
})
vi.mock('~/client', () => ({
  urlFor: (name: string) => `/fr/${name}`,
}))
vi.mock('@adonisjs/inertia/vue', async () => {
  const { LinkStub } = await import('./support/inertia_mocks')
  return { Link: LinkStub }
})

import HealthComponents from '~/components/admin/health/health_components.vue'
import HealthStatusBadge from '~/components/admin/health/health_status_badge.vue'
import HealthSummary from '~/components/admin/health/health_summary.vue'

const report: PlatformHealthReport = {
  status: 'down',
  checkedAt: '2026-11-08T10:00:00.000Z',
  components: [
    { component: 'database', status: 'ok', latencyMs: 4, detail: null },
    { component: 'storage', status: 'down', latencyMs: 3000, detail: 'no answer within 3000 ms' },
    { component: 'search', status: 'disabled', latencyMs: null, detail: null },
  ],
}

const state = (overrides: Partial<HealthComponentState> = {}): HealthComponentState => ({
  component: 'storage',
  status: 'down',
  consecutiveFailures: 3,
  since: '2026-11-08T09:50:00.000Z',
  checkedAt: '2026-11-08T10:00:00.000Z',
  detail: null,
  alerted: true,
  ...overrides,
})

describe('Santé — statut', () => {
  it('nomme les quatre statuts', () => {
    for (const [status, label] of [
      ['ok', 'Sain'],
      ['degraded', 'Dégradé'],
      ['down', 'En panne'],
      ['disabled', 'Non configuré'],
    ] as const) {
      expect(mount(HealthStatusBadge, { props: { status } }).text()).toBe(label)
    }
  })
})

describe('Santé — composants', () => {
  it('affiche le verdict global et chaque composant avec son statut et sa durée', () => {
    const wrapper = mount(HealthComponents, { props: { report, states: [state()] } })

    expect(wrapper.get('[data-testid="health-overall"]').text()).toContain('est en panne')
    const storage = wrapper.get('[data-testid="health-storage"]').text()
    expect(storage).toContain('Stockage')
    expect(storage).toContain('En panne')
    expect(storage).toContain('3000 ms')
    expect(storage).toContain('no answer within 3000 ms')
    expect(storage).toContain('Envoyée')
  })

  it('met un tiret là où il n’y a ni durée ni état conservé', () => {
    const wrapper = mount(HealthComponents, { props: { report, states: [] } })

    const search = wrapper.get('[data-testid="health-search"]').text()
    expect(search).toContain('Non configuré')
    expect(search).not.toContain(' ms')
    expect(search).toContain('—')
  })
})

describe('Santé — tableau de bord', () => {
  it('avertit que les états sont périmés quand la surveillance ne tourne plus', () => {
    const summary: PlatformHealthSummary = {
      status: 'ok',
      checkedAt: '2026-11-08T10:00:00.000Z',
      stale: true,
      components: [state({ component: 'database', status: 'ok' })],
    }

    const wrapper = mount(HealthSummary, { props: { summary } })

    expect(wrapper.get('[data-testid="health-stale"]').text()).toContain('périmés')
  })

  it('invite à attendre le premier passage du job tant que rien n’est conservé', () => {
    const summary: PlatformHealthSummary = {
      status: 'ok',
      components: [],
      checkedAt: null,
      stale: false,
    }

    const text = mount(HealthSummary, { props: { summary } }).get('[data-testid="health-summary"]')

    expect(text.text()).toContain('pas encore tourné')
  })

  it('résume l’état conservé, composant par composant, avec un lien vers le détail', () => {
    const summary: PlatformHealthSummary = {
      status: 'down',
      checkedAt: '2026-11-08T10:00:00.000Z',
      stale: false,
      components: [state({ component: 'database', status: 'ok' }), state()],
    }

    const wrapper = mount(HealthSummary, { props: { summary } })

    expect(wrapper.get('[data-testid="health-summary"]').text()).toContain('est en panne')
    expect(wrapper.text()).toContain('Base de données')
    expect(wrapper.text()).toContain('Stockage')
    expect(wrapper.find('a').attributes('href')).toBe('/fr/admin.health.index')
  })
})
