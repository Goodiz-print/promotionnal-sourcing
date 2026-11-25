import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { answerConfirm, mountConfirmHost } from './support/confirm_dialog'
import type { AdminQueueScheduleRow } from '#shared/types/admin_queue'
import type { QueueHealthReport } from '#shared/types/health'

const translations = {
  'admin.queue.title': 'File d’attente',
  'admin.queue.empty': 'Aucun job ne correspond.',
  'admin.queue.stuck': 'Bloqué',
  'admin.queue.overdue': 'En retard',
  'admin.queue.minutes': '{count} min',
  'admin.queue.statuses.failed': 'Échoué',
  'admin.queue.statuses.active': 'Actif',
  'admin.queue.statuses.pending': 'En attente',
  'admin.queue.statuses.delayed': 'Différé',
  'admin.queue.statuses.completed': 'Terminé',
  'admin.queue.actions.retry': 'Relancer',
  'admin.queue.actions.cancel': 'Annuler',
  'admin.queue.actions.retryConfirm': 'Relancer le job {name} ?',
  'admin.queue.health.title': 'Santé de la queue',
  'admin.queue.health.ok': 'La queue est saine',
  'admin.queue.health.ko': 'La queue est en difficulté',
  'admin.queue.health.details': 'Voir la file d’attente',
  'admin.queue.health.checkedAt': 'Mesurée le {date}',
  'admin.queue.schedules.title': 'Jobs planifiés',
  'admin.queue.schedules.run': 'Lancer maintenant',
  'admin.queue.schedules.confirmRun': 'Lancer le job {name} maintenant ?',
}

const post = vi.hoisted(() => vi.fn())
vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    router: { get: vi.fn(), post },
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({
  urlFor: (name: string, params: Record<string, string>) =>
    `/fr/${name}${params.id ? `/${params.id}` : ''}`,
}))
vi.mock('@adonisjs/inertia/vue', async () => {
  const { LinkStub } = await import('./support/inertia_mocks')
  return { Link: LinkStub }
})

import QueueHealth from '~/components/admin/queue/queue_health.vue'
import QueueSchedules from '~/components/admin/queue/queue_schedules.vue'
import QueueStatusBadge from '~/components/admin/queue/queue_status_badge.vue'

function health(overrides: Partial<QueueHealthReport> = {}): QueueHealthReport {
  return {
    ok: true,
    pendingOverdue: 0,
    oldestPendingAgeMs: null,
    stuckActive: 0,
    failedLast24h: 0,
    checkedAt: '2026-11-05T10:00:00.000Z',
    ...overrides,
  }
}

function schedule(overrides: Partial<AdminQueueScheduleRow> = {}): AdminQueueScheduleRow {
  return {
    id: 'purge-ai-calls',
    name: 'PurgeAiCallsJob',
    cron: '20 4 * * *',
    everyMs: null,
    timezone: 'Europe/Paris',
    status: 'active',
    runCount: 3,
    lastRunAt: null,
    nextRunAt: null,
    runnable: true,
    ...overrides,
  }
}

describe('Queue — santé', () => {
  it('annonce une queue saine', () => {
    const text = mount(QueueHealth, { props: { health: health() } }).text()

    expect(text).toContain('La queue est saine')
  })

  it('alerte et chiffre les retards, jobs bloqués et échecs', () => {
    const wrapper = mount(QueueHealth, {
      props: {
        health: health({
          ok: false,
          pendingOverdue: 4,
          oldestPendingAgeMs: 20 * 60_000,
          stuckActive: 2,
          failedLast24h: 7,
        }),
        counts: { pending: 4, delayed: 0, active: 2, completed: 10, failed: 7 },
      },
    })

    const text = wrapper.text()
    expect(text).toContain('La queue est en difficulté')
    expect(text).toContain('20 min')
    expect(text).toContain('4')
    expect(text).toContain('7')
  })

  it('propose le lien vers la supervision seulement quand il est demandé', () => {
    expect(mount(QueueHealth, { props: { health: health() } }).text()).not.toContain(
      'Voir la file d’attente'
    )
    expect(mount(QueueHealth, { props: { health: health(), linked: true } }).text()).toContain(
      'Voir la file d’attente'
    )
  })
})

describe('Queue — état d’un job', () => {
  it('signale un job bloqué ou en retard', () => {
    const stuck = mount(QueueStatusBadge, { props: { status: 'active', stuck: true } }).text()
    const overdue = mount(QueueStatusBadge, { props: { status: 'pending', overdue: true } }).text()

    expect(stuck).toContain('Actif')
    expect(stuck).toContain('Bloqué')
    expect(overdue).toContain('En retard')
  })
})

describe('Queue — jobs planifiés', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lance un job planifié après confirmation', async () => {
    const host = await mountConfirmHost()
    const wrapper = mount(QueueSchedules, { props: { schedules: [schedule()] } })

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Lancer maintenant')!
      .trigger('click')
    expect(host.find('[data-confirm-dialog="confirm"]').text()).toBe('Lancer maintenant')
    expect(post).not.toHaveBeenCalled()
    await answerConfirm(host, 'confirm')

    expect(post).toHaveBeenCalledWith(
      '/fr/admin.queue.schedules.run/purge-ai-calls',
      {},
      { preserveScroll: true }
    )
  })

  it('ne lance rien si la confirmation est refusée', async () => {
    const host = await mountConfirmHost()
    const wrapper = mount(QueueSchedules, { props: { schedules: [schedule()] } })

    await wrapper.find('button').trigger('click')
    await answerConfirm(host, 'cancel')

    expect(post).not.toHaveBeenCalled()
  })

  it('n’offre pas de lancement pour un job qui ne se lance pas à la main', () => {
    const wrapper = mount(QueueSchedules, {
      props: { schedules: [schedule({ id: 'custom', runnable: false })] },
    })

    expect(wrapper.findAll('button')).toHaveLength(0)
  })
})
