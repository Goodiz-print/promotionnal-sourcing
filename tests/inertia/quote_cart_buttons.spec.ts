import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

const translations = {
  'quote_cart.card.add': 'Ajouter {name} au panier de devis',
  'quote_cart.nav.label': 'Panier de devis',
  'quote_cart.nav.count':
    '{count, plural, =0 {Panier de devis vide} one {# produit dans le panier de devis} other {# produits dans le panier de devis}}',
}

let quoteCartCount: number | undefined

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => {
      const page = m.inertiaPage(translations)
      return { props: { ...page.props, quoteCartCount } }
    },
    router: { post: vi.fn() },
  }
})
vi.mock('~/client', () => ({ urlFor: (route: string) => `/fr/${route}` }))
vi.mock('@adonisjs/inertia/vue', () => ({
  Link: { inheritAttrs: true, template: '<a><slot /></a>' },
}))

const { default: AddButton } = await import('~/components/quote_cart/quote_cart_add_button.vue')
const { default: NavButton } = await import('~/components/quote_cart/quote_cart_nav_button.vue')
const { router } = await import('@inertiajs/vue3')

describe('quote_cart_add_button.vue', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ajoute le produit sans relancer la recherche du catalogue', async () => {
    quoteCartCount = 0
    const wrapper = mount(AddButton, { props: { productId: 7, productName: 'Mug' } })

    const button = wrapper.find('button')
    expect(button.attributes('aria-label')).toBe('Ajouter Mug au panier de devis')
    await button.trigger('click')

    expect(router.post).toHaveBeenCalledWith(
      '/fr/quote_cart.items.store',
      { productId: 7 },
      expect.objectContaining({ preserveScroll: true, only: ['quoteCartCount'] })
    )
  })

  it('est masqué pour qui ne peut pas demander de devis', () => {
    quoteCartCount = undefined
    const wrapper = mount(AddButton, { props: { productId: 7, productName: 'Mug' } })

    expect(wrapper.find('button').exists()).toBe(false)
  })
})

describe('quote_cart_nav_button.vue', () => {
  it('affiche le nombre de produits du panier', () => {
    quoteCartCount = 3
    const wrapper = mount(NavButton)

    expect(wrapper.find('[data-testid="quote-cart-badge"]').text()).toBe('3')
    expect(wrapper.find('a').attributes('aria-label')).toBe('3 produits dans le panier de devis')
  })

  it("n'affiche pas de pastille pour un panier vide", () => {
    quoteCartCount = 0
    const wrapper = mount(NavButton)

    expect(wrapper.find('a').exists()).toBe(true)
    expect(wrapper.find('[data-testid="quote-cart-badge"]').exists()).toBe(false)
  })

  it('est absent pour qui ne peut pas demander de devis', () => {
    quoteCartCount = undefined
    const wrapper = mount(NavButton)

    expect(wrapper.find('a').exists()).toBe(false)
  })
})
