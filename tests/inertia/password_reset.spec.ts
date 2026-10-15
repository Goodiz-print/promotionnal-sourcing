import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const translations = {
  'auth.fields.email': 'E-mail',
  'auth.fields.password': 'Mot de passe',
  'auth.fields.passwordConfirmation': 'Confirmer le mot de passe',
  'auth.forgot.title': 'Mot de passe oublié',
  'auth.forgot.subtitle': 'Saisissez votre adresse e-mail',
  'auth.forgot.submit': 'Envoyer le lien',
  'auth.forgot.back': 'Retour à la connexion',
  'auth.reset.title': 'Nouveau mot de passe',
  'auth.reset.subtitle': 'Choisissez un nouveau mot de passe',
  'auth.reset.submit': 'Enregistrer le mot de passe',
}

const post = vi.fn()

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    useForm: m.makeUseForm({ post }),
  }
})
vi.mock('@adonisjs/inertia/vue', async () => {
  const { LinkStub } = await import('./support/inertia_mocks')
  return { Link: LinkStub }
})
vi.mock('~/client', () => ({
  urlFor: (route: string, params: { locale: string }) => `/${params.locale}/${route}`,
}))

const { default: ForgotPassword } = await import('~/pages/auth/forgot_password.vue')
const { default: ResetPassword } = await import('~/pages/auth/reset_password.vue')

describe('auth/forgot_password', () => {
  it('affiche le formulaire et poste vers la route de demande', async () => {
    const wrapper = mount(ForgotPassword)
    expect(wrapper.text()).toContain('Mot de passe oublié')

    await wrapper.find('form').trigger('submit')
    expect(post).toHaveBeenCalledWith('/fr/password.email')
  })
})

describe('auth/reset_password', () => {
  it("poste vers l'URL signée reçue du serveur, sans la reconstruire", async () => {
    post.mockClear()
    const actionUrl = '/fr/password/reset/3?v=abc&signature=xyz'
    const wrapper = mount(ResetPassword, { props: { actionUrl } })

    await wrapper.find('form').trigger('submit')
    expect(post).toHaveBeenCalledWith(actionUrl)
  })
})
