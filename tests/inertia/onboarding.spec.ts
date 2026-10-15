import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const translations = {
  'onboarding.title': 'Bienvenue',
  'onboarding.subtitle': 'Configurons votre organisation.',
  'onboarding.fields.name': 'Nom de votre organisation',
  'onboarding.fields.type': 'Vous êtes…',
  'onboarding.type.buyer.label': 'Acheteur',
  'onboarding.type.buyer.description': 'Je cherche des objets publicitaires.',
  'onboarding.type.supplier.label': 'Fournisseur',
  'onboarding.type.supplier.description': 'Je propose un catalogue.',
  'onboarding.submit': 'Créer mon organisation',
}

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    useForm: m.makeUseForm(),
    Head: m.HeadStub,
  }
})

vi.mock('~/client', () => ({ urlFor: () => '/fr/onboarding' }))

const { default: Onboarding } = await import('~/pages/onboarding/index.vue')

describe('onboarding/index.vue', () => {
  it('affiche le champ nom et les deux choix acheteur/fournisseur', () => {
    const wrapper = mount(Onboarding)

    expect(wrapper.text()).toContain('Bienvenue')
    expect(wrapper.find('#name').exists()).toBe(true)

    const radios = wrapper.findAll('input[type="radio"]')
    expect(radios).toHaveLength(2)
    expect(wrapper.text()).toContain('Acheteur')
    expect(wrapper.text()).toContain('Fournisseur')
  })
})
