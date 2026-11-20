import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const translations = {
  'supplier.profile.title': 'Profil fournisseur',
  'supplier.profile.subtitle': 'Sous-titre',
  'supplier.profile.submit': 'Enregistrer le profil',
  'supplier.profile.moderation.pending': 'Fiche en cours de validation',
  'supplier.profile.moderation.pendingHint': 'Examen en cours.',
  'supplier.profile.moderation.rejected': 'Fiche rejetée',
  'supplier.profile.moderation.rejectedHint': 'Rejetée.',
  'supplier.profile.moderation.reason': 'Motif : {reason}',
  'supplier.fields.minOrderQuantity': 'Quantité minimum de commande',
  'supplier.fields.deliveryDays': 'Délai de livraison (jours)',
  'supplier.fields.responseTimeDays': 'Délai de réponse (jours)',
  'supplier.fields.deliveryScope': 'Périmètre de livraison',
  'supplier.fields.certifications': 'Certifications',
  'supplier.fields.certificationPlaceholder': 'ex. ISO 9001',
  'supplier.fields.certificationAdd': 'Ajouter une certification',
  'supplier.fields.certificationRemove': 'Retirer',
  'supplier.fields.bio': 'Présentation',
  'supplier.fields.quoteEmail': 'Adresse de réception des demandes',
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
    router: { delete: vi.fn() },
    Head: m.HeadStub,
  }
})

vi.mock('~/client', () => ({ urlFor: () => '/fr/supplier/profile' }))

const { default: SupplierProfile } = await import('~/pages/supplier/profile.vue')

const PENDING = { status: 'pending' as const, reason: null }

describe('supplier/profile.vue', () => {
  it('affiche le formulaire avec les libellés traduits', () => {
    const wrapper = mount(SupplierProfile, {
      props: { profile: null, documents: [], moderation: PENDING },
    })

    expect(wrapper.text()).toContain('Profil fournisseur')
    expect(wrapper.find('#minOrderQuantity').exists()).toBe(true)
    expect(wrapper.find('#deliveryScope').exists()).toBe(true)
    expect(wrapper.find('#bio').exists()).toBe(true)
    expect(wrapper.find('#quoteEmail').attributes('type')).toBe('email')
  })

  it('affiche le motif quand l’organisation est rejetée', () => {
    const wrapper = mount(SupplierProfile, {
      props: {
        profile: null,
        documents: [],
        moderation: { status: 'rejected', reason: 'Dossier incomplet' },
      },
    })

    expect(wrapper.text()).toContain('Fiche rejetée')
    expect(wrapper.text()).toContain('Dossier incomplet')
  })

  it('propose les 3 périmètres de livraison + option non précisé', () => {
    const wrapper = mount(SupplierProfile, {
      props: { profile: null, documents: [], moderation: PENDING },
    })
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
      companyType: null,
      deliveryCountries: null,
      spokenLanguages: null,
      minOrderNote: null,
      quoteEmail: 'devis@fournisseur.test',
      reportFrequency: 'none' as const,
      catalogueUpdateMode: null,
      catalogueUpdateFrequency: null,
      defaultOriginScope: null,
      isFoundingPartner: false,
      foundingPartnerUntil: null,
      createdAt: '2026-07-10T00:00:00.000Z',
      updatedAt: null,
    }

    const wrapper = mount(SupplierProfile, {
      props: { profile, documents: [], moderation: PENDING },
    })

    expect(wrapper.findAll('input[type="text"]')).toHaveLength(profile.certifications.length)
    expect((wrapper.find('#bio').element as HTMLTextAreaElement).value).toBe('Un fournisseur')
    expect((wrapper.find('#quoteEmail').element as HTMLInputElement).value).toBe(
      'devis@fournisseur.test'
    )
  })

  it('ajoute et retire une certification', async () => {
    const wrapper = mount(SupplierProfile, {
      props: { profile: null, documents: [], moderation: PENDING },
    })
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
