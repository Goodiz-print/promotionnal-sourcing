import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reactive, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { answerConfirm, mountConfirmHost } from './support/confirm_dialog'
import type { PasskeyType } from '#shared/types/passkey'

const translations = {
  'account.passkeys.title': 'Passkeys',
  'account.passkeys.subtitle': 'Sans mot de passe.',
  'account.passkeys.empty': 'Aucune passkey enregistrée.',
  'account.passkeys.name': 'Nom de la passkey',
  'account.passkeys.defaultName': 'Mon appareil',
  'account.passkeys.add': 'Ajouter une passkey',
  'account.passkeys.unsupported': 'Navigateur non compatible.',
  'account.passkeys.rename': 'Renommer',
  'account.passkeys.save': 'Enregistrer',
  'account.passkeys.remove': 'Supprimer',
  'account.passkeys.confirmRemove': 'Supprimer « {name} » ?',
  'account.passkeys.createdAt': 'Ajoutée le {date}',
  'account.passkeys.lastUsedAt': 'utilisée le {date}',
  'account.passkeys.neverUsed': 'jamais utilisée',
  'account.passkeys.failed': 'Échec.',
  'auth.passkey.login': 'Se connecter avec une passkey',
  'auth.passkey.failed': 'Connexion impossible.',
}

const post = vi.fn()
const patch = vi.fn()
const destroy = vi.fn()
const supported = ref(true)
const register = vi.fn()
const authenticate = vi.fn()

vi.mock('@inertiajs/vue3', () => ({
  usePage: () => ({ props: { locale: 'fr', supportedLocales: ['fr', 'en'], translations } }),
  useForm: (data: Record<string, unknown>) =>
    reactive({
      ...data,
      errors: {},
      processing: false,
      post,
      patch,
      delete: destroy,
      reset: vi.fn(),
    }),
}))
vi.mock('~/client', () => ({
  urlFor: (name: string, params?: { id?: number }) =>
    `/fr/${name}${params?.id ? `/${params.id}` : ''}`,
}))
vi.mock('~/composables/use_passkey', () => ({
  usePasskey: () => ({ supported, register, authenticate }),
}))

const { default: PasskeysSection } = await import('~/components/account/passkeys_section.vue')
const { default: PasskeyLogin } = await import('~/components/auth/passkey_login.vue')

const passkey: PasskeyType = {
  id: 7,
  name: 'MacBook',
  deviceType: 'multiDevice',
  backedUp: true,
  createdAt: '2026-10-01T10:00:00.000Z',
  lastUsedAt: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  supported.value = true
})

describe('account/passkeys_section', () => {
  it('affiche un état vide', () => {
    const wrapper = mount(PasskeysSection, { props: { passkeys: [] } })

    expect(wrapper.text()).toContain('Aucune passkey enregistrée.')
  })

  it('liste les passkeys et supprime après confirmation', async () => {
    const host = await mountConfirmHost()
    const wrapper = mount(PasskeysSection, { props: { passkeys: [passkey] } })

    expect(wrapper.text()).toContain('MacBook')
    expect(wrapper.text()).toContain('jamais utilisée')

    const remove = wrapper.findAll('button').find((b) => b.text() === 'Supprimer')!
    await remove.trigger('click')
    expect(host.find('#confirm-dialog-message').text()).toBe('Supprimer « MacBook » ?')
    await answerConfirm(host, 'confirm')

    expect(destroy).toHaveBeenCalledWith('/fr/account.passkeys.destroy/7', { preserveScroll: true })
  })

  it("ne supprime rien si l'utilisateur annule", async () => {
    const host = await mountConfirmHost()
    const wrapper = mount(PasskeysSection, { props: { passkeys: [passkey] } })

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Supprimer')!
      .trigger('click')
    await answerConfirm(host, 'cancel')

    expect(destroy).not.toHaveBeenCalled()
  })

  it('lance la cérémonie puis poste le résultat', async () => {
    register.mockResolvedValue('{"id":"abc"}')
    const wrapper = mount(PasskeysSection, { props: { passkeys: [] } })

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(register).toHaveBeenCalledWith('/fr/account.passkeys.options')
    expect(post).toHaveBeenCalledWith(
      '/fr/account.passkeys.store',
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it("ne poste rien si l'utilisateur annule la cérémonie", async () => {
    register.mockResolvedValue(null)
    const wrapper = mount(PasskeysSection, { props: { passkeys: [] } })

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(post).not.toHaveBeenCalled()
  })

  it('signale un navigateur incompatible', () => {
    supported.value = false
    const wrapper = mount(PasskeysSection, { props: { passkeys: [] } })

    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('Navigateur non compatible.')
  })
})

describe('auth/passkey_login', () => {
  it('est masqué sans support WebAuthn', () => {
    supported.value = false
    const wrapper = mount(PasskeyLogin)

    expect(wrapper.find('button').exists()).toBe(false)
  })

  it("poste l'assertion en conservant le redirect", async () => {
    authenticate.mockResolvedValue('{"id":"abc"}')
    const wrapper = mount(PasskeyLogin, { props: { redirect: '/fr/suppliers' } })

    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(authenticate).toHaveBeenCalledWith('/fr/passkey.login.options')
    expect(post).toHaveBeenCalledWith('/fr/passkey.login?redirect=%2Ffr%2Fsuppliers')
  })

  it('affiche une erreur si la cérémonie échoue', async () => {
    authenticate.mockRejectedValue(new Error('boom'))
    const wrapper = mount(PasskeyLogin)

    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(post).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Connexion impossible.')
  })
})
