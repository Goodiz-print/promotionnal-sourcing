import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const translations = {
  'auth.verify.title': 'Vérifiez votre adresse e-mail',
  'auth.verify.description': 'Nous avons envoyé un lien de confirmation à {email}.',
  'auth.verify.hint': 'Vous ne le trouvez pas ?',
  'auth.verify.resend': "Renvoyer l'e-mail",
}

vi.mock('@inertiajs/vue3', () => ({
  usePage: () => ({ props: { locale: 'fr', supportedLocales: ['fr', 'en'], translations } }),
}))
vi.mock('@adonisjs/inertia/vue', () => ({
  Form: { template: '<form><slot :processing="false" /></form>' },
}))

const { default: VerifyEmail } = await import('~/pages/auth/verify_email.vue')

describe('auth/verify_email', () => {
  it("affiche l'adresse à vérifier et l'action de renvoi", () => {
    const wrapper = mount(VerifyEmail, { props: { email: 'nouveau@example.com' } })

    expect(wrapper.text()).toContain('Vérifiez votre adresse e-mail')
    expect(wrapper.text()).toContain('nouveau@example.com')
    expect(wrapper.find('button[type="submit"]').text()).toBe("Renvoyer l'e-mail")
  })
})
