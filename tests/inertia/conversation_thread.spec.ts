import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { ConversationMessageType, RfqThreadType } from '#shared/types/conversation'

const translations = {
  'messaging.thread.empty': "Aucun échange pour l'instant.",
  'messaging.thread.emptyHint': 'Écrivez un premier message : il sera relayé par mail.',
  'messaging.thread.blocked': 'Ce fil a été bloqué par la plateforme.',
  'messaging.thread.yourTeam': 'Votre équipe',
  'messaging.thread.viaMail': 'par mail',
  'messaging.thread.unknownSender': 'adresse non reconnue',
  'messaging.thread.attachments': 'Pièces jointes',
  'messaging.thread.bodyLabel': 'Votre message',
  'messaging.thread.placeholder': 'Écrivez votre message…',
  'messaging.thread.maxLength': '{max} caractères au plus.',
  'messaging.thread.send': 'Envoyer',
  'messaging.thread.report.action': 'Signaler',
  'messaging.thread.report.reasonLabel': 'Motif du signalement',
  'messaging.thread.report.submit': 'Signaler ce message',
  'messaging.thread.report.cancel': 'Annuler',
  'messaging.thread.report.reasons.spam': 'Spam',
  'messaging.thread.report.reasons.off_platform': 'Contournement de la plateforme',
}

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return { usePage: () => m.inertiaPage(translations), router: { post: vi.fn() } }
})
vi.mock('~/client', () => ({
  urlFor: (route: string, params: { id: number }) => `/${route}/${params.id}`,
}))

const { default: ConversationThread } =
  await import('~/components/messaging/conversation_thread.vue')
const { router } = await import('@inertiajs/vue3')

beforeEach(() => vi.mocked(router.post).mockClear())

function message(overrides: Partial<ConversationMessageType> = {}): ConversationMessageType {
  return {
    id: 1,
    body: 'Bonjour',
    side: 'supplier',
    mine: false,
    authorName: null,
    viaMail: false,
    mailSender: null,
    createdAt: '2026-11-21T10:00:00.000Z',
    attachments: [],
    ...overrides,
  }
}

function thread(overrides: Partial<RfqThreadType> = {}): RfqThreadType {
  return {
    rfqSupplierId: 3,
    counterpartName: null,
    blocked: false,
    canWrite: true,
    messages: [],
    ...overrides,
  }
}

function mountThread(value: RfqThreadType) {
  return mount(ConversationThread, {
    props: {
      thread: value,
      title: 'Échanges avec l’agence',
      description: 'Vos messages sont transmis par mail.',
      fallbackCounterpart: "L'agence",
      postUrl: '/fr/supplier/rfqs/9/messages',
    },
  })
}

describe('conversation_thread.vue', () => {
  it('nomme l’autre côté par le fil, son propre côté par l’auteur, et signale un mail', () => {
    const wrapper = mountThread(
      thread({
        messages: [
          message({ id: 1, body: 'Question', viaMail: true }),
          message({ id: 2, body: 'Réponse', side: 'agency', mine: true, authorName: 'Paul' }),
          message({ id: 3, body: 'Relance', side: 'agency', mine: true }),
        ],
      })
    )

    const items = wrapper.findAll('ol > li')
    expect(items).toHaveLength(3)
    expect(items[0].text()).toContain("L'agence")
    expect(items[0].text()).toContain('par mail')
    expect(items[1].text()).toContain('Paul')
    expect(items[2].text()).toContain('Votre équipe')
    // Seul un message de l'autre côté se signale.
    expect(items[0].text()).toContain('Signaler')
    expect(items[1].text()).not.toContain('Signaler')
  })

  it('préfère le nom de l’autre côté quand le serveur le fournit', () => {
    const wrapper = mountThread(thread({ counterpartName: 'Agence Dupont', messages: [message()] }))

    expect(wrapper.text()).toContain('Agence Dupont')
    expect(wrapper.text()).not.toContain("L'agence")
  })

  it('montre l’expéditeur d’un mail, et s’il n’est pas reconnu', () => {
    const wrapper = mountThread(
      thread({
        messages: [
          message({
            id: 1,
            viaMail: true,
            mailSender: { name: 'Jean', address: 'jean@fournisseur.test', known: false },
          }),
          message({ id: 2, viaMail: true }),
        ],
      })
    )

    const senders = wrapper.findAll('[data-mail-sender]')
    expect(senders).toHaveLength(1)
    expect(senders[0].text()).toContain('Jean <jean@fournisseur.test>')
    expect(senders[0].text()).toContain('adresse non reconnue')
  })

  it('liste les pièces jointes d’un message', () => {
    const wrapper = mountThread(
      thread({ messages: [message({ attachments: [{ id: 5, filename: 'logo.png' }] })] })
    )

    expect(wrapper.find('[aria-label="Pièces jointes"]').text()).toContain('logo.png')
  })

  it('un fil vide invite à écrire', () => {
    const wrapper = mountThread(thread())

    expect(wrapper.text()).toContain("Aucun échange pour l'instant.")
    expect(wrapper.text()).toContain('il sera relayé par mail')
  })

  it('n’envoie rien tant que le message est vide, puis poste et vide le champ', async () => {
    const wrapper = mountThread(thread())
    const submit = wrapper.find('button[type="submit"]')
    expect(submit.attributes('disabled')).toBeDefined()

    await wrapper.find('textarea').setValue('  Bonjour  ')
    await wrapper.find('form').trigger('submit')

    expect(router.post).toHaveBeenCalledWith(
      '/fr/supplier/rfqs/9/messages',
      { body: '  Bonjour  ' },
      expect.objectContaining({ preserveScroll: true })
    )
    const options = vi.mocked(router.post).mock.calls[0][2] as { onSuccess: () => void }
    options.onSuccess()
    await wrapper.vm.$nextTick()
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('')
  })

  it('affiche l’erreur de validation renvoyée par le serveur', async () => {
    const wrapper = mountThread(thread())
    await wrapper.find('textarea').setValue('x')
    await wrapper.find('form').trigger('submit')

    const options = vi.mocked(router.post).mock.calls[0][2] as {
      onError: (errors: Record<string, string>) => void
    }
    options.onError({ body: 'Le champ body est obligatoire' })
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Le champ body est obligatoire')
  })

  it('un fil bloqué ou sans droit d’écrire n’a pas de formulaire', () => {
    const blocked = mountThread(thread({ blocked: true, canWrite: false }))
    const readOnly = mountThread(thread({ canWrite: false }))

    expect(blocked.text()).toContain('bloqué par la plateforme')
    expect(blocked.find('form').exists()).toBe(false)
    expect(readOnly.find('form').exists()).toBe(false)
    expect(readOnly.text()).not.toContain('il sera relayé par mail')
  })

  it('signale un message de l’autre côté avec le motif choisi', async () => {
    const wrapper = mountThread(thread({ messages: [message({ id: 42 })] }))

    const reportButton = wrapper.findAll('button').find((b) => b.text() === 'Signaler')!
    await reportButton.trigger('click')
    await wrapper.find('select').setValue('off_platform')
    const submit = wrapper.findAll('button').find((b) => b.text() === 'Signaler ce message')!
    await submit.trigger('click')

    expect(router.post).toHaveBeenCalledWith(
      '/messages.report/42',
      { reason: 'off_platform' },
      expect.objectContaining({ preserveScroll: true })
    )
  })
})
