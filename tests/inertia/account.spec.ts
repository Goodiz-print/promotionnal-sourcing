import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'
import { mount } from '@vue/test-utils'
import type { AccountType } from '#shared/types/account'

const translations = {
  'auth.fields.fullName': 'Nom complet',
  'auth.fields.email': 'E-mail',
  'account.profile.title': 'Informations personnelles',
  'account.profile.language': 'Langue',
  'account.profile.submit': 'Enregistrer',
  'account.profile.unverified': 'Adresse non vérifiée',
  'account.password.title': 'Mot de passe',
  'account.password.current': 'Mot de passe actuel',
  'account.password.new': 'Nouveau mot de passe',
  'account.password.confirm': 'Confirmer',
  'account.password.submit': 'Changer le mot de passe',
  'account.danger.title': 'Zone de danger',
  'account.danger.subtitle': 'Irréversible.',
  'account.danger.deleteTitle': 'Supprimer mon compte',
  'account.danger.description': 'Vos données sont effacées.',
  'account.danger.blockedIntro': 'Dernier propriétaire de : {names}.',
  'account.danger.confirmPassword': 'Confirmez avec votre mot de passe',
  'account.danger.submit': 'Supprimer définitivement',
  'account.danger.confirm': 'Supprimer ?',
}

const patch = vi.fn()
const destroy = vi.fn()

vi.mock('@inertiajs/vue3', () => ({
  usePage: () => ({ props: { locale: 'fr', supportedLocales: ['fr', 'en'], translations } }),
  useForm: (data: Record<string, unknown>) =>
    reactive({
      ...data,
      errors: {},
      processing: false,
      patch,
      delete: destroy,
      transform() {
        return this
      },
      reset: vi.fn(),
    }),
}))
vi.mock('~/client', () => ({ urlFor: (name: string) => `/fr/${name}` }))

const { default: ProfileForm } = await import('~/components/account/profile_form.vue')
const { default: PasswordForm } = await import('~/components/account/password_form.vue')
const { default: DangerZone } = await import('~/components/account/danger_zone.vue')

const account: AccountType = {
  fullName: 'Marie Membre',
  email: 'marie@example.com',
  locale: 'fr',
  isEmailVerified: true,
}

beforeEach(() => {
  patch.mockClear()
  destroy.mockClear()
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
})

describe('account/profile_form', () => {
  it('préremplit le formulaire et envoie un PATCH', async () => {
    const wrapper = mount(ProfileForm, { props: { account } })

    expect((wrapper.find('#email').element as HTMLInputElement).value).toBe('marie@example.com')
    expect((wrapper.find('#fullName').element as HTMLInputElement).value).toBe('Marie Membre')
    expect(wrapper.text()).not.toContain('Adresse non vérifiée')

    await wrapper.find('form').trigger('submit')
    expect(patch).toHaveBeenCalledWith('/fr/account.update', { preserveScroll: true })
  })

  it('signale une adresse non vérifiée', () => {
    const wrapper = mount(ProfileForm, {
      props: { account: { ...account, isEmailVerified: false } },
    })
    expect(wrapper.text()).toContain('Adresse non vérifiée')
  })
})

describe('account/password_form', () => {
  it('envoie un PATCH vers la route du mot de passe', async () => {
    const wrapper = mount(PasswordForm)

    await wrapper.find('form').trigger('submit')
    expect(patch).toHaveBeenCalledWith(
      '/fr/account.password.update',
      expect.objectContaining({ preserveScroll: true })
    )
  })
})

describe('account/danger_zone', () => {
  it('liste les organisations bloquantes et masque le formulaire de suppression', () => {
    const wrapper = mount(DangerZone, { props: { blockingOrganizations: ['Acme', 'Globex'] } })

    expect(wrapper.text()).toContain('Dernier propriétaire de : Acme, Globex.')
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('demande confirmation puis supprime avec le mot de passe', async () => {
    const wrapper = mount(DangerZone, { props: { blockingOrganizations: [] } })

    await wrapper.find('form').trigger('submit')
    expect(window.confirm).toHaveBeenCalled()
    expect(destroy).toHaveBeenCalledWith('/fr/account.destroy', { preserveScroll: true })
  })

  it("ne supprime rien si l'utilisateur annule", async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
    const wrapper = mount(DangerZone, { props: { blockingOrganizations: [] } })

    await wrapper.find('form').trigger('submit')
    expect(destroy).not.toHaveBeenCalled()
  })
})
