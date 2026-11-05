import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { AdminAnnouncementRow } from '#shared/types/announcement'

const translations = {
  'admin.announcements.title': 'Annonces',
  'admin.announcements.retry': 'Relancer',
  'admin.announcements.empty': 'Aucune annonce.',
  'admin.announcements.new': 'Nouvelle annonce',
  'admin.announcements.noInApp': 'Pas de notification in-app',
  'admin.announcements.readRate': '{read} / {total} ({percent} %)',
  'admin.announcements.audiences.buyers': 'Acheteurs',
  'admin.announcements.audiences.all': 'Tous les utilisateurs',
  'admin.announcements.audiences.organization': 'Une organisation',
  'admin.announcements.audiences.suppliers': 'Fournisseurs',
  'admin.announcements.audiences.agencies': 'Agences',
  'admin.announcements.audienceOption': '{label} ({count} utilisateurs)',
  'admin.announcements.statuses.sent': 'Envoyée',
  'admin.announcements.statuses.failed': 'Échec',
  'admin.announcements.channels.inApp': 'Notification in-app',
  'admin.announcements.channels.email': 'Mail',
  'admin.announcements.form.audienceOption': '{label} ({count} utilisateurs)',
  'admin.announcements.form.submit': "Envoyer l'annonce",
  'admin.announcements.form.organizationId': "Identifiant de l'organisation",
  'admin.announcements.form.titleFr': 'Titre (français)',
}

const post = vi.hoisted(() => vi.fn())
vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    useForm: m.makeUseForm({ post }),
    router: { get: vi.fn() },
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({
  urlFor: (name: string) => `/fr/${name}`,
}))
vi.mock('@adonisjs/inertia/vue', async () => {
  const { LinkStub } = await import('./support/inertia_mocks')
  return { Link: LinkStub }
})

import AnnouncementsIndex from '~/pages/admin/announcements/index.vue'
import AnnouncementForm from '~/components/admin/announcement/announcement_form.vue'

function row(overrides: Partial<AdminAnnouncementRow> = {}): AdminAnnouncementRow {
  return {
    id: 1,
    title: 'Maintenance',
    audience: 'buyers',
    organization: null,
    sendInApp: true,
    sendEmail: false,
    status: 'sent',
    recipients: 8,
    read: 2,
    error: null,
    retryable: false,
    createdBy: 'admin@example.test',
    createdAt: '2026-11-05T10:00:00.000Z',
    sentAt: '2026-11-05T10:00:05.000Z',
    ...overrides,
  }
}

function mountIndex(rows: AdminAnnouncementRow[]) {
  return mount(AnnouncementsIndex, {
    props: {
      announcements: {
        data: rows,
        meta: { total: rows.length, perPage: 25, currentPage: 1, lastPage: 1 },
      },
    },
  })
}

describe('Annonces — historique', () => {
  beforeEach(() => vi.clearAllMocks())

  it('affiche le segment, les destinataires et le taux de lecture', () => {
    const text = mountIndex([row()]).text()

    expect(text).toContain('Maintenance')
    expect(text).toContain('Acheteurs')
    expect(text).toContain('Envoyée')
    expect(text).toContain('2 / 8 (25 %)')
  })

  it('n’annonce pas de taux de lecture quand il n’y a pas de notification in-app', () => {
    const text = mountIndex([row({ sendInApp: false, sendEmail: true })]).text()

    expect(text).toContain('Pas de notification in-app')
    expect(text).not.toContain('/ 8')
  })

  it('propose de relancer une annonce échouée, et seulement celle-là', async () => {
    const wrapper = mountIndex([
      row({ id: 1, status: 'failed', retryable: true, error: 'boom' }),
      row({ id: 2 }),
    ])

    const buttons = wrapper.findAll('button').filter((b) => b.text() === 'Relancer')
    expect(buttons).toHaveLength(1)
    expect(wrapper.text()).toContain('boom')
  })

  it('affiche l’état vide', () => {
    expect(mountIndex([]).text()).toContain('Aucune annonce.')
  })
})

describe('Annonces — formulaire', () => {
  beforeEach(() => vi.clearAllMocks())

  it('annonce la taille de chaque segment et masque l’organisation par défaut', () => {
    const wrapper = mount(AnnouncementForm, {
      props: { audienceSizes: { all: 12, buyers: 8, suppliers: 4, agencies: 2 } },
    })

    expect(wrapper.text()).toContain('Acheteurs (8 utilisateurs)')
    expect(wrapper.text()).toContain('Fournisseurs (4 utilisateurs)')
    expect(wrapper.text()).not.toContain("Identifiant de l'organisation")
  })

  it('envoie le formulaire', async () => {
    const wrapper = mount(AnnouncementForm, {
      props: { audienceSizes: { all: 12, buyers: 8, suppliers: 4, agencies: 2 } },
    })

    await wrapper.find('form').trigger('submit')

    expect(post).toHaveBeenCalledWith('/fr/admin.announcements.store')
  })
})
