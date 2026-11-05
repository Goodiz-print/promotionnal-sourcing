import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type {
  AdminConversationDetail,
  AdminConversationRow,
  AdminMessageRow,
} from '#shared/types/admin_messaging'

const translations = {
  'admin.messaging.title': 'Messagerie',
  'admin.messaging.untitled': 'Conversation n° {id}',
  'admin.messaging.hidden': 'Message masqué',
  'admin.messaging.blocked': 'Bloquée',
  'admin.messaging.unknownAuthor': 'Auteur inconnu',
  'admin.messaging.actions.hide': 'Masquer',
  'admin.messaging.actions.unhide': 'Réafficher',
  'admin.messaging.actions.warn': 'Avertir',
  'admin.messaging.actions.dismiss': 'Classer sans suite',
  'admin.messaging.actions.block': 'Bloquer la conversation',
  'admin.messaging.actions.unblock': 'Débloquer la conversation',
  'admin.messaging.confirm.hide': 'Masquer ?',
  'admin.messaging.reasons.off_platform': 'Contournement',
  'admin.messaging.status.open': 'Ouvert',
  'admin.messaging.block.title': 'Blocage',
  'admin.messaging.block.reason': 'Motif',
  'admin.messaging.messages': 'Messages',
  'admin.messaging.empty': 'Aucune conversation.',
}

const post = vi.fn()

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => ({
      ...m.inertiaPage(translations),
      props: { ...m.inertiaPage(translations).props, user: { platformRole: 'moderator' } },
    }),
    useForm: m.makeUseForm(),
    router: {
      get: vi.fn(),
      post: (...args: unknown[]) => post(...args),
    },
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

const { default: MessagingIndex } = await import('~/pages/admin/messaging/index.vue')
const { default: MessagingShow } = await import('~/pages/admin/messaging/show.vue')

const META = { total: 1, perPage: 25, currentPage: 1, lastPage: 1 }

function row(extra: Partial<AdminConversationRow> = {}): AdminConversationRow {
  return {
    id: 4,
    subject: 'Devis stylos',
    rfqId: null,
    buyer: { id: 1, name: 'Acme' },
    supplier: { id: 2, name: 'Goodies Corp' },
    messagesCount: 3,
    openReportsCount: 0,
    blockedAt: null,
    lastMessageAt: '2026-11-01T10:00:00.000Z',
    createdAt: '2026-10-30T10:00:00.000Z',
    ...extra,
  }
}

function message(extra: Partial<AdminMessageRow> = {}): AdminMessageRow {
  return {
    id: 10,
    body: 'Contactez-moi hors plateforme',
    authorEmail: 'sales@example.com',
    authorOrganizationId: 2,
    createdAt: '2026-11-01T10:00:00.000Z',
    hiddenAt: null,
    reports: [],
    ...extra,
  }
}

function detail(messages: AdminMessageRow[], conversation = row()): AdminConversationDetail {
  return { conversation, blockedReason: null, messages }
}

const filters = { buyer: null, supplier: null, withOpenReports: false, blocked: false }

describe('admin/messaging/index', () => {
  it('liste les fils avec leurs signalements ouverts et leur blocage', () => {
    const wrapper = mount(MessagingIndex, {
      props: {
        conversations: {
          data: [row({ openReportsCount: 2, blockedAt: '2026-11-02T10:00:00.000Z' })],
          meta: META,
        },
        filters,
      },
    })
    const rows = wrapper.findAll('tbody tr')

    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('Devis stylos')
    expect(rows[0].text()).toContain('Acme')
    expect(rows[0].text()).toContain('2')
    expect(rows[0].text()).toContain('Bloquée')
  })

  it('affiche l’état vide sans tableau', () => {
    const wrapper = mount(MessagingIndex, {
      props: { conversations: { data: [], meta: { ...META, total: 0 } }, filters },
    })

    expect(wrapper.text()).toContain('Aucune conversation.')
    expect(wrapper.find('table').exists()).toBe(false)
  })
})

describe('admin/messaging/show', () => {
  beforeEach(() => {
    post.mockClear()
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    )
  })

  it('masque un message après confirmation, par un POST Inertia', async () => {
    const wrapper = mount(MessagingShow, { props: { detail: detail([message()]) } })

    const hide = wrapper.findAll('button').find((button) => button.text() === 'Masquer')
    await hide!.trigger('click')

    expect(post).toHaveBeenCalledTimes(1)
    expect(post.mock.calls[0][0]).toBe('/fr/admin.messaging.hide/10')
  })

  it('ne masque rien si la confirmation est refusée', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false)
    )
    const wrapper = mount(MessagingShow, { props: { detail: detail([message()]) } })

    const hide = wrapper.findAll('button').find((button) => button.text() === 'Masquer')
    await hide!.trigger('click')

    expect(post).not.toHaveBeenCalled()
  })

  it('propose de réafficher un message déjà masqué', () => {
    const wrapper = mount(MessagingShow, {
      props: { detail: detail([message({ hiddenAt: '2026-11-02T10:00:00.000Z' })]) },
    })
    const labels = wrapper.findAll('button').map((button) => button.text())

    expect(labels).toContain('Réafficher')
    expect(labels).not.toContain('Masquer')
    expect(wrapper.text()).toContain('Message masqué')
  })

  it('montre un signalement ouvert et permet de le classer sans suite', async () => {
    const wrapper = mount(MessagingShow, {
      props: {
        detail: detail([
          message({
            reports: [
              {
                id: 7,
                status: 'open',
                resolution: null,
                reason: 'off_platform',
                details: null,
                reporterEmail: 'buyer@example.com',
                createdAt: '2026-11-01T11:00:00.000Z',
              },
            ],
          }),
        ]),
      },
    })

    expect(wrapper.text()).toContain('Contournement')
    expect(wrapper.text()).toContain('buyer@example.com')
    const dismiss = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Classer sans suite')
    await dismiss!.trigger('click')

    expect(post.mock.calls[0][0]).toBe('/fr/admin.messaging.dismiss/7')
  })

  it('propose le déblocage d’un fil bloqué et le blocage sinon', () => {
    const open = mount(MessagingShow, { props: { detail: detail([message()]) } })
    expect(open.text()).toContain('Bloquer la conversation')

    const blocked = mount(MessagingShow, {
      props: {
        detail: detail([message()], row({ blockedAt: '2026-11-02T10:00:00.000Z' })),
      },
    })
    expect(blocked.text()).toContain('Débloquer la conversation')
    expect(blocked.text()).not.toContain('Bloquer la conversation')
  })
})
