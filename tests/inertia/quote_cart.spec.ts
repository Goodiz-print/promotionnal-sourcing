import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { QuoteCartGroupType } from '#shared/types/quote_cart'

const translations = {
  'quote_cart.title': 'Panier de devis',
  'quote_cart.subtitle': 'Rassemblez les produits',
  'quote_cart.empty.title': 'Votre panier de devis est vide',
  'quote_cart.empty.description': 'Ajoutez des produits',
  'quote_cart.empty.browse': 'Parcourir le catalogue',
  'quote_cart.group.items': '{count, plural, one {# produit} other {# produits}}',
  'quote_cart.group.unreachable': 'Fournisseurs non joignables',
  'quote_cart.group.unreachableDescription': 'Ces produits restent dans votre panier.',
  'quote_cart.line.quantity': 'Quantité',
  'quote_cart.line.note': 'Précisions',
  'quote_cart.line.remove': 'Retirer {name} du panier',
  'quote_cart.line.belowMinimum': 'Minimum de commande : {count} pièces',
  'quote_cart.checkout.title': 'Envoyer les demandes',
  'quote_cart.checkout.titleDraft': 'Créer les demandes',
  'quote_cart.checkout.description': 'En-tête commun',
  'quote_cart.checkout.fieldTitle': 'Objet',
  'quote_cart.checkout.fieldTitleHint': 'Nom du fournisseur ajouté',
  'quote_cart.checkout.fieldDescription': 'Contexte',
  'quote_cart.checkout.fieldDeadline': 'Échéance',
  'quote_cart.checkout.summary':
    '{count, plural, one {Une demande sera envoyée à : {suppliers}} other {# demandes seront envoyées à : {suppliers}}}',
  'quote_cart.checkout.summaryDraft':
    '{count, plural, one {Un brouillon pour : {suppliers}} other {# brouillons pour : {suppliers}}}',
  'quote_cart.checkout.draftNotice': 'Créées en brouillon',
  'quote_cart.checkout.submit':
    '{count, plural, one {Envoyer la demande} other {Envoyer les # demandes}}',
  'quote_cart.checkout.submitDraft':
    '{count, plural, one {Créer le brouillon} other {Créer les # brouillons}}',
}

const post = vi.fn()

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    useForm: m.makeUseForm({ post }),
    router: { patch: vi.fn(), delete: vi.fn() },
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({
  urlFor: (route: string, params: { id?: number }) =>
    params.id ? `/fr/${route}/${params.id}` : `/fr/${route}`,
}))
vi.mock('@adonisjs/inertia/vue', () => ({ Link: { template: '<a><slot /></a>' } }))

const { default: Show } = await import('~/pages/quote_cart/show.vue')
const { router } = await import('@inertiajs/vue3')

const item = (id: number, name: string, minQuantity: number | null = null) => ({
  id,
  productId: id * 10,
  productSlug: `p-${id}`,
  productName: name,
  imageUrl: null,
  minQuantity,
  quantity: 100,
  note: null,
})

const groups: QuoteCartGroupType[] = [
  {
    supplierOrganizationId: 1,
    supplierName: 'Nordic Promo',
    items: [item(1, 'Mug'), item(2, 'Stylo')],
  },
  { supplierOrganizationId: 2, supplierName: 'Textile Co', items: [item(3, 'Tote bag', 500)] },
  { supplierOrganizationId: null, supplierName: null, items: [item(4, 'Casquette')] },
]

describe('quote_cart/show.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it("affiche l'état vide", () => {
    const wrapper = mount(Show, { props: { groups: [], canSend: true } })

    expect(wrapper.text()).toContain('Votre panier de devis est vide')
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('groupe les produits par fournisseur et annonce une demande par fournisseur joignable', () => {
    const wrapper = mount(Show, { props: { groups, canSend: true } })

    const sections = wrapper.findAll('[data-testid="quote-cart-group"]')
    expect(sections).toHaveLength(3)
    expect(sections[0].text()).toContain('Nordic Promo')
    expect(sections[0].text()).toContain('2 produits')
    expect(sections[2].text()).toContain('Fournisseurs non joignables')
    expect(wrapper.find('[data-testid="quote-cart-summary"]').text()).toBe(
      '2 demandes seront envoyées à : Nordic Promo, Textile Co'
    )
    expect(wrapper.text()).toContain('Envoyer les 2 demandes')
  })

  it('signale une quantité sous le minimum de commande', async () => {
    const wrapper = mount(Show, { props: { groups, canSend: true } })

    await wrapper.find('#quote-cart-quantity-3').setValue('20')
    expect(wrapper.text()).toContain('Minimum de commande : 500 pièces')
  })

  it('enregistre la quantité après une pause de saisie', async () => {
    vi.useFakeTimers()
    const wrapper = mount(Show, { props: { groups, canSend: true } })

    await wrapper.find('#quote-cart-quantity-1').setValue('300')
    expect(router.patch).not.toHaveBeenCalled()
    vi.runAllTimers()

    expect(router.patch).toHaveBeenCalledWith(
      '/fr/quote_cart.items.update/1',
      { quantity: 300 },
      { preserveScroll: true, preserveState: true, only: ['groups'] }
    )
  })

  it('retire une ligne', async () => {
    const wrapper = mount(Show, { props: { groups, canSend: true } })

    await wrapper.find('button[aria-label="Retirer Stylo du panier"]').trigger('click')
    expect(router.delete).toHaveBeenCalledWith('/fr/quote_cart.items.destroy/2', {
      preserveScroll: true,
    })
  })

  it('valide le panier', async () => {
    const wrapper = mount(Show, { props: { groups, canSend: true } })

    await wrapper.find('#quote-cart-title').setValue('Salon 2027')
    await wrapper.find('form').trigger('submit')
    expect(post).toHaveBeenCalledWith('/fr/quote_cart.checkout', { preserveScroll: true })
  })

  it('annonce des brouillons à qui ne peut pas envoyer', () => {
    const wrapper = mount(Show, { props: { groups, canSend: false } })

    expect(wrapper.text()).toContain('Créées en brouillon')
    expect(wrapper.text()).toContain('Créer les 2 brouillons')
  })
})
