import { afterEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

const page = reactive({
  url: '/fr/rfqs/1',
  props: {
    locale: 'fr',
    supportedLocales: ['fr', 'en'],
    translations: {
      'common.confirmDialog.title': 'Confirmer l’action ?',
      'common.confirmDialog.confirm': 'Confirmer',
      'common.confirmDialog.cancel': 'Annuler',
    },
  },
})

vi.mock('@inertiajs/vue3', () => ({ usePage: () => page }))

const { default: BaseConfirmDialog } = await import('~/components/base/base_confirm_dialog.vue')
const { default: ConfirmDialogHost } = await import('~/components/app/confirm_dialog_host.vue')
const { useConfirm, useConfirmHost } = await import('~/composables/use_confirm')

const PROPS = {
  open: true,
  title: 'Retenir ce devis ?',
  message: 'La demande sera clôturée.',
  confirmLabel: 'Retenir',
  cancelLabel: 'Annuler',
}

const confirmButton = '[data-confirm-dialog="confirm"]'
const cancelButton = '[data-confirm-dialog="cancel"]'

afterEach(() => {
  useConfirmHost().cancel()
})

describe('base_confirm_dialog', () => {
  it('ouvre une fenêtre modale avec titre, message et libellés', async () => {
    const wrapper = mount(BaseConfirmDialog, { props: PROPS, attachTo: document.body })
    await flushPromises()

    const dialog = wrapper.find('dialog').element as HTMLDialogElement
    expect(dialog.open).toBe(true)
    expect(wrapper.attributes('role')).toBe('alertdialog')
    expect(wrapper.find('#confirm-dialog-title').text()).toBe('Retenir ce devis ?')
    expect(wrapper.find('#confirm-dialog-message').text()).toBe('La demande sera clôturée.')
    expect(wrapper.find(confirmButton).text()).toBe('Retenir')
    expect(wrapper.find(cancelButton).text()).toBe('Annuler')
    wrapper.unmount()
  })

  it('se referme quand `open` repasse à false', async () => {
    const wrapper = mount(BaseConfirmDialog, { props: PROPS, attachTo: document.body })
    await flushPromises()
    await wrapper.setProps({ open: false })
    await flushPromises()

    expect((wrapper.find('dialog').element as HTMLDialogElement).open).toBe(false)
    wrapper.unmount()
  })

  it('émet confirm et cancel depuis ses deux boutons', async () => {
    const wrapper = mount(BaseConfirmDialog, { props: PROPS })

    await wrapper.find(confirmButton).trigger('click')
    await wrapper.find(cancelButton).trigger('click')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('Échap (événement cancel natif) et clic sur le voile valent « Annuler »', async () => {
    const wrapper = mount(BaseConfirmDialog, { props: PROPS })

    await wrapper.find('dialog').trigger('cancel')
    await wrapper.find('dialog').trigger('click')
    await wrapper.find('#confirm-dialog-message').trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(2)
  })

  it('par défaut : bouton primaire, focus initial sur « Confirmer »', () => {
    const wrapper = mount(BaseConfirmDialog, { props: PROPS })

    expect(wrapper.find(confirmButton).classes()).toContain('bg-indigo-500')
    expect(wrapper.find(confirmButton).attributes('autofocus')).toBeDefined()
    expect(wrapper.find(cancelButton).attributes('autofocus')).toBeUndefined()
  })

  it('en danger : bouton danger, focus initial sur « Annuler »', () => {
    const wrapper = mount(BaseConfirmDialog, { props: { ...PROPS, tone: 'danger' as const } })

    expect(wrapper.find(confirmButton).classes()).toContain('text-danger')
    expect(wrapper.find(cancelButton).attributes('autofocus')).toBeDefined()
    expect(wrapper.find(confirmButton).attributes('autofocus')).toBeUndefined()
  })
})

describe('use_confirm', () => {
  it('expose la demande puis résout true quand l’hôte accepte', async () => {
    const host = useConfirmHost()
    const answer = useConfirm().confirm({ message: 'Continuer ?' })

    expect(host.request.value).toEqual({ message: 'Continuer ?' })
    host.accept()

    await expect(answer).resolves.toBe(true)
    expect(host.request.value).toBeNull()
  })

  it('résout false quand l’hôte annule', async () => {
    const answer = useConfirm().confirm({ message: 'Continuer ?' })
    useConfirmHost().cancel()

    await expect(answer).resolves.toBe(false)
  })

  it('une nouvelle demande annule la précédente restée sans réponse', async () => {
    const { confirm } = useConfirm()
    const first = confirm({ message: 'Première' })
    const second = confirm({ message: 'Seconde' })

    await expect(first).resolves.toBe(false)
    expect(useConfirmHost().request.value?.message).toBe('Seconde')
    useConfirmHost().accept()
    await expect(second).resolves.toBe(true)
  })

  it('répondre sans demande en cours ne fait rien', () => {
    expect(() => useConfirmHost().accept()).not.toThrow()
  })
})

describe('confirm_dialog_host', () => {
  it('rend la demande avec les libellés génériques traduits', async () => {
    const wrapper = mount(ConfirmDialogHost)
    const answer = useConfirm().confirm({ message: 'Supprimer ?', tone: 'danger' })
    await flushPromises()

    expect(wrapper.find('#confirm-dialog-title').text()).toBe('Confirmer l’action ?')
    expect(wrapper.find('#confirm-dialog-message').text()).toBe('Supprimer ?')
    expect(wrapper.find(cancelButton).text()).toBe('Annuler')
    expect(wrapper.find(confirmButton).text()).toBe('Confirmer')
    expect(wrapper.find(confirmButton).classes()).toContain('text-danger')

    await wrapper.find(confirmButton).trigger('click')
    await expect(answer).resolves.toBe(true)
  })

  it('les libellés fournis remplacent les génériques', async () => {
    const wrapper = mount(ConfirmDialogHost)
    void useConfirm().confirm({ message: 'm', title: 'Retenir ?', confirmLabel: 'Retenir' })
    await flushPromises()

    expect(wrapper.find('#confirm-dialog-title').text()).toBe('Retenir ?')
    expect(wrapper.find(confirmButton).text()).toBe('Retenir')
  })

  it('une navigation annule la demande en cours', async () => {
    mount(ConfirmDialogHost)
    const answer = useConfirm().confirm({ message: 'Continuer ?' })

    page.url = '/fr/rfqs'
    await flushPromises()

    await expect(answer).resolves.toBe(false)
  })
})
