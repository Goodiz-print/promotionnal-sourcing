import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { QuoteCartGroupType, QuoteCartItemType } from '#shared/types/quote_cart'

const translations = {
  'quote_cart.title': 'Panier de devis',
  'quote_cart.subtitle': 'Rassemblez les produits',
  'quote_cart.empty.title': 'Votre panier de devis est vide',
  'quote_cart.empty.description': 'Ajoutez des produits',
  'quote_cart.empty.browse': 'Parcourir le catalogue',
  'quote_cart.group.items': '{count, plural, one {# produit} other {# produits}}',
  'quote_cart.line.quantity': 'Quantité',
  'quote_cart.line.note': 'Précisions',
  'quote_cart.line.remove': 'Retirer {name} du panier',
  'quote_cart.line.belowMinimum': 'Minimum de commande : {count} pièces',
  'quote_cart.line.variant': 'Variante',
  'quote_cart.line.variantAny': 'À préciser',
  'quote_cart.line.marking': 'Marquage',
  'quote_cart.line.markingNone': 'Sans marquage',
  'quote_cart.line.markingColors': 'Couleurs',
  'quote_cart.line.markingColorsMax': '{count} couleurs max.',
  'quote_cart.estimate.onRequest': 'Prix sur devis',
  'quote_cart.estimate.unitPrice': 'Prix unitaire',
  'quote_cart.estimate.markingUnitPrice': 'Marquage / pièce',
  'quote_cart.estimate.setupCharge': 'Frais techniques',
  'quote_cart.estimate.total': 'Total estimé',
  'quote_cart.estimate.totalPartial': 'Total estimé (hors marquage)',
  'quote_cart.estimate.belowFirstTier': 'Sous le premier palier',
  'quote_cart.estimate.nextTier': 'Dès {count} pièces : {price} / pièce',
  'quote_cart.estimate.subtotal': 'Sous-total estimé : {amount}',
  'quote_cart.estimate.subtotalPartial': 'Sous-total estimé (incomplet) : {amount}',
  'quote_cart.estimate.disclaimer': 'Le devis fait foi.',
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

const item = (
  id: number,
  name: string,
  minQuantity: number | null = null,
  overrides: Partial<QuoteCartItemType> = {}
): QuoteCartItemType => ({
  id,
  productId: id * 10,
  productSlug: `p-${id}`,
  productName: name,
  imageUrl: null,
  minQuantity,
  quantity: 100,
  note: null,
  variantId: null,
  markingPositionTechniqueId: null,
  markingColors: null,
  variantOptions: [],
  markingOptions: [],
  estimate: null,
  ...overrides,
})

const priced = item(1, 'Mug', null, {
  variantOptions: [
    { id: 11, label: 'Rouge', sku: 'MUG-R' },
    { id: 12, label: 'Bleu', sku: 'MUG-B' },
  ],
  markingOptions: [
    {
      id: 21,
      label: 'Face — Tampographie',
      positionName: 'Face',
      techniqueName: 'Tampographie',
      maxColors: 4,
      setupCharge: '40.00',
    },
  ],
  estimate: {
    currency: 'EUR',
    unitPrice: '2.10',
    markingUnitPrice: null,
    setupCharge: null,
    total: '210.00',
    partial: false,
    belowFirstTier: false,
    nextTier: { minQuantity: 250, unitPrice: '1.85', currency: 'EUR' },
  },
})

const groups: QuoteCartGroupType[] = [
  {
    supplierOrganizationId: 1,
    supplierName: 'Nordic Promo',
    items: [priced, item(2, 'Stylo')],
    subtotals: [{ currency: 'EUR', total: '210.00' }],
    estimateComplete: false,
  },
  {
    supplierOrganizationId: 2,
    supplierName: 'Textile Co',
    items: [item(3, 'Tote bag', 500)],
    subtotals: [],
    estimateComplete: false,
  },
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

  it('groupe les produits par fournisseur et annonce une demande par fournisseur', () => {
    const wrapper = mount(Show, { props: { groups, canSend: true } })

    const sections = wrapper.findAll('[data-testid="quote-cart-group"]')
    expect(sections).toHaveLength(2)
    expect(sections[0].text()).toContain('Nordic Promo')
    expect(sections[0].text()).toContain('2 produits')
    expect(sections[1].text()).toContain('Textile Co')
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
      { preserveScroll: true, preserveState: true, only: ['groups'], async: true }
    )
  })

  it('enregistre ensemble la quantité et la note saisies dans la même pause', async () => {
    vi.useFakeTimers()
    const wrapper = mount(Show, { props: { groups, canSend: true } })

    await wrapper.find('#quote-cart-quantity-1').setValue('500')
    await wrapper.find('#quote-cart-note-1').setValue('Logo 2 couleurs')
    vi.runAllTimers()

    expect(router.patch).toHaveBeenCalledTimes(1)
    expect(router.patch).toHaveBeenCalledWith(
      '/fr/quote_cart.items.update/1',
      { quantity: 500, note: 'Logo 2 couleurs' },
      { preserveScroll: true, preserveState: true, only: ['groups'], async: true }
    )
  })

  it("emporte la saisie en attente avec un choix d'option", async () => {
    vi.useFakeTimers()
    const wrapper = mount(Show, { props: { groups, canSend: true } })

    await wrapper.find('#quote-cart-quantity-1').setValue('400')
    await wrapper.find('#quote-cart-variant-1').setValue('12')
    vi.runAllTimers()

    expect(router.patch).toHaveBeenCalledTimes(1)
    expect(router.patch).toHaveBeenCalledWith(
      '/fr/quote_cart.items.update/1',
      { quantity: 400, variantId: 12 },
      { preserveScroll: true, preserveState: true, only: ['groups'], async: true }
    )
  })

  it("affiche l'estimation dégressive, le palier suivant et le sous-total", () => {
    const wrapper = mount(Show, { props: { groups, canSend: true } })

    const [mug, stylo] = wrapper.findAll('[data-testid="quote-cart-estimate"]')
    expect(mug.text()).toContain('Prix unitaire')
    expect(mug.text()).toMatch(/2,10\s€/)
    expect(mug.text()).toMatch(/Total estimé\s*210,00\s€/)
    expect(mug.find('[data-testid="quote-cart-next-tier"]').text()).toMatch(
      /Dès 250 pièces : 1,85\s€ \/ pièce/
    )
    expect(stylo.text()).toBe('Prix sur devis')
    // Une ligne sur devis : sous-total signalé incomplet.
    expect(wrapper.find('[data-testid="quote-cart-subtotal"]').text()).toMatch(
      /Sous-total estimé \(incomplet\) : 210,00\s€/
    )
  })

  it('enregistre aussitôt le choix de variante', async () => {
    const wrapper = mount(Show, { props: { groups, canSend: true } })

    await wrapper.find('#quote-cart-variant-1').setValue('12')
    expect(router.patch).toHaveBeenCalledWith(
      '/fr/quote_cart.items.update/1',
      { variantId: 12 },
      { preserveScroll: true, preserveState: true, only: ['groups'], async: true }
    )
  })

  it('propose le nombre de couleurs une fois un marquage choisi', async () => {
    const wrapper = mount(Show, { props: { groups, canSend: true } })

    expect(wrapper.find('#quote-cart-colors-1').exists()).toBe(false)
    await wrapper.find('#quote-cart-marking-1').setValue('21')
    expect(router.patch).toHaveBeenCalledWith(
      '/fr/quote_cart.items.update/1',
      { markingPositionTechniqueId: 21, markingColors: null },
      { preserveScroll: true, preserveState: true, only: ['groups'], async: true }
    )
    expect(wrapper.find('#quote-cart-colors-1').exists()).toBe(true)
    expect(wrapper.text()).toContain('4 couleurs max.')

    await wrapper.find('#quote-cart-colors-1').setValue('9')
    expect(router.patch).toHaveBeenCalledTimes(1)
    await wrapper.find('#quote-cart-colors-1').setValue('2')
    expect(router.patch).toHaveBeenLastCalledWith(
      '/fr/quote_cart.items.update/1',
      { markingColors: 2 },
      { preserveScroll: true, preserveState: true, only: ['groups'], async: true }
    )
  })

  it("n'affiche pas de sélecteur d'option pour un produit sans variante ni marquage", () => {
    const wrapper = mount(Show, { props: { groups, canSend: true } })

    expect(wrapper.find('#quote-cart-variant-2').exists()).toBe(false)
    expect(wrapper.find('#quote-cart-marking-2').exists()).toBe(false)
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
