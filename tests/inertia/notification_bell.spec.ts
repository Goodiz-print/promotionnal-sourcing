import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { NotificationItemType } from '#shared/types/notification'

const translations = {
  'notifications.title': 'Notifications',
  'notifications.empty': 'Aucune notification pour le moment.',
  'notifications.seeAll': 'Tout voir',
  'notifications.markAllRead': 'Tout marquer comme lu',
  'notifications.unread': 'Non lue',
  'notifications.unreadCount': '{count} non lues',
  'notifications.toast': 'Vous avez une nouvelle notification.',
  'notifications.types.rfq.received': '{buyerName} vous a envoyé une demande : {rfqTitle}.',
  'notifications.types.quote.accepted': '{buyerName} a accepté votre devis.',
}

const pageProps: { unreadNotificationsCount: number; recentNotifications: NotificationItemType[] } =
  { unreadNotificationsCount: 0, recentNotifications: [] }
let onCreated: () => void = () => {}

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => ({ props: { ...m.inertiaPage(translations).props, ...pageProps } }),
    router: { reload: vi.fn(), patch: vi.fn(), post: vi.fn() },
  }
})
vi.mock('~/client', () => ({
  urlFor: (name: string, params: { id?: number }) =>
    `/fr/${name}${params.id ? `/${params.id}` : ''}`,
}))
vi.mock('@adonisjs/inertia/vue', () => ({
  Link: { props: ['route'], template: '<a :data-route="route"><slot /></a>' },
}))
vi.mock('vue-sonner', () => ({ toast: { info: vi.fn() } }))
vi.mock('~/composables/use_notification_stream', () => ({
  useNotificationStream: (callback: () => void) => {
    onCreated = callback
  },
}))

const { default: NotificationBell } =
  await import('~/components/notifications/notification_bell.vue')
const { router } = await import('@inertiajs/vue3')
const { toast } = await import('vue-sonner')

function notification(overrides: Partial<NotificationItemType> = {}): NotificationItemType {
  return {
    id: 1,
    type: 'rfq.received',
    data: { buyerName: 'Acme', rfqTitle: 'Tote bags' },
    readAt: null,
    createdAt: '2026-10-25T08:00:00.000Z',
    href: '/fr/supplier/rfqs/9',
    ...overrides,
  }
}

beforeEach(() => {
  vi.mocked(router.reload).mockReset()
  vi.mocked(router.patch).mockReset()
  vi.mocked(router.post).mockReset()
  vi.mocked(toast.info).mockReset()
  pageProps.unreadNotificationsCount = 0
  pageProps.recentNotifications = []
})

describe('notification_bell.vue', () => {
  it('affiche la pastille des non lues, et la masque à zéro', () => {
    pageProps.unreadNotificationsCount = 3
    expect(mount(NotificationBell).text()).toContain('3')

    pageProps.unreadNotificationsCount = 0
    expect(mount(NotificationBell).find('[data-testid="unread-badge"]').exists()).toBe(false)
  })

  it('plafonne la pastille à 99+', () => {
    pageProps.unreadNotificationsCount = 250
    expect(mount(NotificationBell).text()).toContain('99+')
  })

  it('liste les dernières notifications avec leur texte', () => {
    pageProps.unreadNotificationsCount = 1
    pageProps.recentNotifications = [notification()]

    expect(mount(NotificationBell).text()).toContain('Acme vous a envoyé une demande : Tote bags.')
  })

  it('annonce l’absence de notification', () => {
    expect(mount(NotificationBell).text()).toContain('Aucune notification pour le moment.')
  })

  it('cliquer une notification la marque lue côté serveur, qui redirige vers son écran', async () => {
    pageProps.recentNotifications = [notification({ id: 42 })]
    const wrapper = mount(NotificationBell)

    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Acme'))!
      .trigger('click')

    expect(router.patch).toHaveBeenCalledWith('/fr/notifications.read/42')
  })

  it('« tout marquer comme lu » n’apparaît que s’il y a des non lues', async () => {
    expect(mount(NotificationBell).text()).not.toContain('Tout marquer comme lu')

    pageProps.unreadNotificationsCount = 2
    const wrapper = mount(NotificationBell)
    const button = wrapper.findAll('button').find((b) => b.text() === 'Tout marquer comme lu')
    await button!.trigger('click')

    expect(router.post).toHaveBeenCalledWith(
      '/fr/notifications.readAll',
      {},
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('à l’arrivée d’une notification : toast et rechargement du compteur', () => {
    mount(NotificationBell)

    onCreated()

    expect(toast.info).toHaveBeenCalledWith('Vous avez une nouvelle notification.')
    expect(router.reload).toHaveBeenCalledWith({ only: ['unreadNotificationsCount'] })
  })
})
