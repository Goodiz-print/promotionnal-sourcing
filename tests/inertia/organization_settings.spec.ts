import { describe, it, expect, vi } from 'vitest'
import { reactive } from 'vue'
import { mount } from '@vue/test-utils'

const translations = {
  'organization.settings.title': "Paramètres de l'organisation",
  'organization.settings.subtitle': 'Sous-titre',
  'organization.settings.submit': 'Enregistrer',
  'organization.fields.name': 'Nom',
  'organization.fields.siret': 'SIRET',
  'organization.fields.vatNumber': 'N° TVA intracommunautaire',
  'organization.fields.email': 'Email',
  'organization.fields.phone': 'Téléphone',
  'organization.fields.website': 'Site web',
  'organization.fields.industry': "Secteur d'activité",
  'organization.fields.size': "Taille de l'organisation",
  'organization.fields.description': 'Description',
  'organization.fields.addressLine1': 'Adresse',
  'organization.fields.addressLine2': "Complément d'adresse",
  'organization.fields.city': 'Ville',
  'organization.fields.postalCode': 'Code postal',
  'organization.fields.country': 'Pays',
  'organization.fields.logo': 'Logo',
  'organization.size.none': 'Non précisé',
  'organization.size.micro': 'Micro-entreprise',
  'organization.size.small': 'Petite entreprise',
  'organization.size.medium': 'Moyenne entreprise',
  'organization.size.large': 'Grande entreprise',
  'organization.size.enterprise': 'Groupe / Entreprise',
  'organization.logo.none': 'Aucun logo',
  'organization.logo.replace': 'Remplacer le logo',
  'organization.logo.remove': 'Supprimer le logo',
  'organization.logo.cancel': 'Annuler',
}

vi.mock('@inertiajs/vue3', () => ({
  usePage: () => ({ props: { locale: 'fr', supportedLocales: ['fr', 'en'], translations } }),
  useForm: (data: Record<string, unknown>) =>
    reactive({
      ...data,
      errors: {},
      processing: false,
      transform() {
        return this
      },
      post: vi.fn(),
    }),
  Head: { render: () => null },
}))

vi.mock('~/client', () => ({ urlFor: () => '/fr/organization/settings' }))

const { default: OrganizationSettings } = await import('~/pages/organization/settings.vue')

const baseOrganization = {
  id: 1,
  name: 'EuroGoods',
  slug: 'eurogoods-org',
  siret: null,
  vatNumber: null,
  email: null,
  phone: null,
  website: null,
  industry: null,
  size: null,
  organizationType: 'supplier' as const,
  description: null,
  logoUrl: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  postalCode: null,
  country: 'FR',
  createdAt: '2026-07-10T00:00:00.000Z',
  updatedAt: null,
}

describe('organization/settings.vue', () => {
  it('affiche le formulaire avec les libellés traduits', () => {
    const wrapper = mount(OrganizationSettings, { props: { organization: baseOrganization } })

    expect(wrapper.text()).toContain("Paramètres de l'organisation")
    expect(wrapper.find('#name').exists()).toBe(true)
    expect(wrapper.find('#siret').exists()).toBe(true)
    expect(wrapper.find('#addressLine1').exists()).toBe(true)
    expect(wrapper.find('#size').exists()).toBe(true)
  })

  it('propose les 5 tailles + option non précisé', () => {
    const wrapper = mount(OrganizationSettings, { props: { organization: baseOrganization } })
    const options = wrapper.find('#size').findAll('option')

    expect(options).toHaveLength(6)
    expect(options[0].text()).toBe('Non précisé')
  })

  it('pré-remplit les champs depuis la prop organization', () => {
    const organization = {
      ...baseOrganization,
      name: 'EuroGoods SAS',
      city: 'Lyon',
      country: 'FR',
    }

    const wrapper = mount(OrganizationSettings, { props: { organization } })

    expect((wrapper.find('#name').element as HTMLInputElement).value).toBe('EuroGoods SAS')
    expect((wrapper.find('#city').element as HTMLInputElement).value).toBe('Lyon')
  })

  it('ne rend jamais de champ slug éditable', () => {
    const wrapper = mount(OrganizationSettings, { props: { organization: baseOrganization } })

    expect(wrapper.find('#slug').exists()).toBe(false)
  })
})
