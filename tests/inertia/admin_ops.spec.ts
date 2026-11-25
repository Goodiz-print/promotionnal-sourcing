import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { answerConfirm, mountConfirmHost } from './support/confirm_dialog'
import type { AdminMailOverview, AdminStorageOverview } from '#shared/types/admin_ops'

const translations = {
  'admin.mail.statuses.failed': 'En échec',
  'admin.mail.statuses.in_progress': 'En cours',
  'admin.mail.statuses.sent': 'Envoyé',
  'admin.mail.kinds.organization-invitation': 'Invitation à une organisation',
  'admin.mail.kinds.password-reset': 'Réinitialisation du mot de passe',
  'admin.mail.rates.title': 'Taux d’échec par type',
  'admin.mail.rates.description': 'Sur les {days} derniers jours.',
  'admin.mail.rates.failedTotal': '{count} mail(s) à rejouer.',
  'admin.mail.rates.empty': 'Aucun envoi sur la période.',
  'admin.mail.rates.sent': 'Envoyés',
  'admin.mail.rates.failed': 'En échec',
  'admin.mail.rates.inProgress': 'En cours',
  'admin.mail.rates.rate': 'Taux d’échec',
  'admin.mail.columns.kind': 'Type',
  'admin.mail.columns.actions': 'Actions',
  'admin.mail.actions.retryAll': 'Rejouer tous les échecs',
  'admin.mail.actions.retryKind': 'Rejouer ce type',
  'admin.mail.actions.retryAllConfirm': 'Tout rejouer ?',
  'admin.mail.actions.retryKindConfirm': 'Rejouer « {kind} » ?',
  'admin.storage.statuses.ready': 'Prêt',
  'admin.storage.statuses.pending_upload': 'Envoi en cours',
  'admin.storage.statuses.pending_delete': 'Suppression en attente',
  'admin.storage.totals.title': 'Registre des fichiers',
  'admin.storage.totals.description': 'Objets suivis.',
  'admin.storage.totals.objects': '{count} objet(s)',
  'admin.storage.recover.ok': 'Aucun arriéré de plus de {hours} h.',
  'admin.storage.recover.backlog': '{count} ligne(s) en attente depuis plus de {hours} h.',
  'admin.storage.recover.submit': 'Relancer la reprise',
  'admin.storage.recover.hint': 'Aide.',
  'admin.storage.recover.confirm': 'Relancer la reprise ?',
  'admin.storage.stale.title': 'Arriéré de reprise',
  'admin.storage.stale.description': 'Plus de {hours} h.',
  'admin.storage.stale.empty': 'Aucun arriéré.',
  'admin.storage.stale.truncated': '{shown} lignes sur {total}.',
  'admin.storage.organizations.title': 'Volume par organisation',
  'admin.storage.organizations.description': 'Fichiers prêts.',
  'admin.storage.organizations.empty': 'Aucun fichier rattaché.',
  'admin.storage.organizations.unattributed': 'Sans organisation : {size}.',
  'admin.storage.columns.key': 'Clé',
  'admin.storage.columns.status': 'État',
  'admin.storage.columns.size': 'Taille',
  'admin.storage.columns.createdAt': 'Créé le',
  'admin.storage.columns.organization': 'Organisation',
  'admin.storage.columns.objects': 'Fichiers',
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

import MailRates from '~/components/admin/mail/mail_rates.vue'
import MailStatusBadge from '~/components/admin/mail/mail_status_badge.vue'
import StorageOrganizations from '~/components/admin/storage/storage_organizations.vue'
import StorageStale from '~/components/admin/storage/storage_stale.vue'
import StorageTotals from '~/components/admin/storage/storage_totals.vue'

function mailOverview(overrides: Partial<AdminMailOverview> = {}): AdminMailOverview {
  return {
    windowDays: 30,
    failedTotal: 2,
    rates: [
      {
        kind: 'organization-invitation',
        sent: 6,
        failed: 2,
        inProgress: 1,
        failureRate: 0.25,
      },
      { kind: 'password-reset', sent: 4, failed: 0, inProgress: 0, failureRate: 0 },
    ],
    ...overrides,
  }
}

function storageOverview(overrides: Partial<AdminStorageOverview> = {}): AdminStorageOverview {
  return {
    totals: [
      { status: 'pending_upload', count: 2, bytes: 2048 },
      { status: 'ready', count: 5, bytes: 1_572_864 },
      { status: 'pending_delete', count: 0, bytes: 0 },
    ],
    thresholdHours: 24,
    staleCount: 0,
    stale: [],
    unattributedBytes: 512,
    organizations: [],
    ...overrides,
  }
}

describe('Emails — état', () => {
  it('nomme les trois états', () => {
    for (const [status, label] of [
      ['failed', 'En échec'],
      ['in_progress', 'En cours'],
      ['sent', 'Envoyé'],
    ] as const) {
      expect(mount(MailStatusBadge, { props: { status } }).text()).toBe(label)
    }
  })
})

describe('Emails — taux d’échec', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('affiche le taux de chaque type, ou un tiret sans envoi terminé', () => {
    const text = mount(MailRates, {
      props: {
        overview: mailOverview({
          rates: [
            {
              kind: 'organization-invitation',
              sent: 6,
              failed: 2,
              inProgress: 0,
              failureRate: 0.25,
            },
            { kind: 'password-reset', sent: 0, failed: 0, inProgress: 1, failureRate: null },
          ],
        }),
      },
    }).text()

    expect(text).toContain('Invitation à une organisation')
    expect(text).toContain('25')
    expect(text).toContain('—')
  })

  it('n’offre le rejeu d’un type que s’il a des échecs', () => {
    const wrapper = mount(MailRates, { props: { overview: mailOverview() } })

    const kindButtons = wrapper.findAll('button').filter((b) => b.text() === 'Rejouer ce type')
    expect(kindButtons).toHaveLength(1)
  })

  it('rejoue toute la dead-letter après confirmation', async () => {
    const host = await mountConfirmHost()
    const wrapper = mount(MailRates, { props: { overview: mailOverview() } })

    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Rejouer tous les échecs'))!
      .trigger('click')
    expect(post).not.toHaveBeenCalled()
    await answerConfirm(host, 'confirm')

    expect(post).toHaveBeenCalledWith('/fr/admin.mail.retryAll', {}, { preserveScroll: true })
  })

  it('rejoue un seul type en le désignant', async () => {
    const host = await mountConfirmHost()
    const wrapper = mount(MailRates, { props: { overview: mailOverview() } })

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Rejouer ce type')!
      .trigger('click')
    await answerConfirm(host, 'confirm')

    expect(post).toHaveBeenCalledWith(
      '/fr/admin.mail.retryAll',
      { kind: 'organization-invitation' },
      { preserveScroll: true }
    )
  })

  it('ne rejoue rien si la confirmation est refusée, ni sans échec', async () => {
    const host = await mountConfirmHost()
    const wrapper = mount(MailRates, { props: { overview: mailOverview() } })
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Rejouer tous les échecs'))!
      .trigger('click')
    await answerConfirm(host, 'cancel')
    expect(post).not.toHaveBeenCalled()

    const empty = mount(MailRates, { props: { overview: mailOverview({ failedTotal: 0 }) } })
    expect(
      empty
        .findAll('button')
        .find((b) => b.text().includes('Rejouer tous les échecs'))!
        .attributes('disabled')
    ).toBeDefined()
  })

  it('signale l’absence d’envoi sur la période', () => {
    const text = mount(MailRates, {
      props: { overview: mailOverview({ failedTotal: 0, rates: [] }) },
    }).text()

    expect(text).toContain('Aucun envoi sur la période.')
  })
})

describe('Stockage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rassure quand il n’y a pas d’arriéré', () => {
    const text = mount(StorageTotals, { props: { overview: storageOverview() } }).text()

    expect(text).toContain('Aucun arriéré de plus de 24 h.')
    expect(text).toContain('1.5 MB')
    expect(text).toContain('Envoi en cours')
  })

  it('alerte sur l’arriéré', () => {
    const text = mount(StorageTotals, {
      props: { overview: storageOverview({ staleCount: 3 }) },
    }).text()

    expect(text).toContain('3 ligne(s) en attente depuis plus de 24 h.')
  })

  it('relance la reprise après confirmation seulement', async () => {
    const host = await mountConfirmHost()
    const wrapper = mount(StorageTotals, { props: { overview: storageOverview() } })

    await wrapper.find('button').trigger('click')
    await answerConfirm(host, 'cancel')
    expect(post).not.toHaveBeenCalled()

    await wrapper.find('button').trigger('click')
    await answerConfirm(host, 'confirm')
    expect(post).toHaveBeenCalledWith(
      '/fr/admin.storage.recover',
      {},
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('liste l’arriéré, et précise quand la liste est tronquée', () => {
    const rows = [
      {
        id: 1,
        key: 'promotionnal-sourcing/production/abc.jpg',
        status: 'pending_upload' as const,
        size: 2048,
        createdAt: '2026-11-01T10:00:00.000Z',
      },
    ]

    const full = mount(StorageStale, {
      props: { overview: storageOverview({ staleCount: 1, stale: rows }) },
    }).text()
    expect(full).toContain('promotionnal-sourcing/production/abc.jpg')
    expect(full).toContain('2.0 KB')
    expect(full).not.toContain('lignes sur')

    const truncated = mount(StorageStale, {
      props: { overview: storageOverview({ staleCount: 80, stale: rows }) },
    }).text()
    expect(truncated).toContain('1 lignes sur 80.')
  })

  it('affiche un état vide sans arriéré', () => {
    const text = mount(StorageStale, { props: { overview: storageOverview() } }).text()

    expect(text).toContain('Aucun arriéré.')
  })

  it('classe les organisations et rappelle le volume non rattaché', () => {
    const text = mount(StorageOrganizations, {
      props: {
        overview: storageOverview({
          organizations: [
            { organizationId: 1, name: 'Acme Goodies', count: 3, bytes: 1_048_576 },
            { organizationId: 2, name: 'Bleu Marine', count: 1, bytes: 1024 },
          ],
        }),
      },
    }).text()

    expect(text).toContain('Acme Goodies')
    expect(text).toContain('1.0 MB')
    expect(text).toContain('Sans organisation : 512 B.')
  })
})
