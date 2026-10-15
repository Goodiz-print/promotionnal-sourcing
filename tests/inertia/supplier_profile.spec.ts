import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const translations = {
  'supplier.profile.title': 'Profil fournisseur',
  'supplier.profile.subtitle': 'Sous-titre',
  'supplier.profile.submit': 'Enregistrer le profil',
  'supplier.fields.minOrderQuantity': 'Quantité minimum de commande',
  'supplier.fields.deliveryDays': 'Délai de livraison (jours)',
  'supplier.fields.responseTimeDays': 'Délai de réponse (jours)',
  'supplier.fields.deliveryScope': 'Périmètre de livraison',
  'supplier.fields.certifications': 'Certifications',
  'supplier.fields.certificationPlaceholder': 'ex. ISO 9001',
  'supplier.fields.certificationAdd': 'Ajouter une certification',
  'supplier.fields.certificationRemove': 'Retirer',
  'supplier.fields.bio': 'Présentation',
  'supplier.deliveryScope.none': 'Non précisé',
  'supplier.deliveryScope.national': 'National',
  'supplier.deliveryScope.europe': 'Europe',
  'supplier.deliveryScope.worldwide': 'International',
}

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    useForm: m.makeUseForm(),
    Head: m.HeadStub,
  }
})

vi.mock('~/client', () => ({ urlFor: () => '/fr/supplier/profile' }))

const { default: SupplierProfile } = await import('~/pages/supplier/profile.vue')

describe('supplier/profile.vue', () => {
  it('affiche le formulaire avec les libellés traduits', () => {
    const wrapper = mount(SupplierProfile, { props: { profile: null } })

    expect(wrapper.text()).toContain('Profil fournisseur')
    expect(wrapper.find('#minOrderQuantity').exists()).toBe(true)
    expect(wrapper.find('#deliveryScope').exists()).toBe(true)
    expect(wrapper.find('#bio').exists()).toBe(true)
  })

  it('propose les 3 périmètres de livraison + option non précisé', () => {
    const wrapper = mount(SupplierProfile, { props: { profile: null } })
    const options = wrapper.find('#deliveryScope').findAll('option')

    expect(options).toHaveLength(4)
    expect(options.map((o) => o.text())).toEqual([
      'Non précisé',
      'National',
      'Europe',
      'International',
    ])
  })

  it('pré-remplit les champs depuis le profil existant', () => {
    const profile = {
      id: 1,
      organizationId: 2,
      minOrderQuantity: 50,
      deliveryDays: 10,
      deliveryScope: 'europe' as const,
      certifications: ['ISO 9001', 'FSC'],
      bio: 'Un fournisseur',
      responseTimeDays: 2,
      createdAt: '2026-07-10T00:00:00.000Z',
      updatedAt: null,
    }

    const wrapper = mount(SupplierProfile, { props: { profile } })

    expect(wrapper.findAll('input[type="text"]')).toHaveLength(profile.certifications.length)
    expect((wrapper.find('#bio').element as HTMLTextAreaElement).value).toBe('Un fournisseur')
  })

  it('ajoute et retire une certification', async () => {
    const wrapper = mount(SupplierProfile, { props: { profile: null } })
    const addButton = wrapper
      .findAll('button')
      .find((b) => b.text() === 'Ajouter une certification')!

    expect(wrapper.findAll('input[type="text"]')).toHaveLength(0)
    await addButton.trigger('click')
    expect(wrapper.findAll('input[type="text"]')).toHaveLength(1)

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Retirer')!
      .trigger('click')
    expect(wrapper.findAll('input[type="text"]')).toHaveLength(0)
  })
})
