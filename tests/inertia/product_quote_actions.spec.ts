import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { ProductRfqContextType } from '#shared/types/rfq'

const translations = {
  'products.show.signInToRequest': 'Se connecter pour demander un devis',
  'quote_cart.product.add': 'Ajouter au panier de devis',
  'quote_cart.product.inCart': 'Dans votre panier de devis',
  'quote_cart.product.viewCart': 'Voir le panier',
  'quote_cart.product.detailedRequest': 'Demande détaillée',
  'quote_cart.product.quantity': 'Quantité',
}

let user: { id: number } | undefined

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => {
      const page = m.inertiaPage(translations)
      return { props: { ...page.props, user } }
    },
    router: { get: vi.fn(), post: vi.fn() },
  }
})
vi.mock('~/client', () => ({
  urlFor: (route: string, params: { slug?: string }) =>
    route === 'products.show' ? `/fr/products/${params.slug}` : `/fr/${route}`,
}))

vi.mock('@adonisjs/inertia/vue', () => ({
  Link: { props: ['href'], template: '<a :href="href"><slot /></a>' },
}))

const { default: ProductQuoteActions } =
  await import('~/components/products/product_quote_actions.vue')
const { router } = await import('@inertiajs/vue3')

function mountActions(rfqContext: ProductRfqContextType, minQuantity: number | null = 50) {
  return mount(ProductQuoteActions, {
    props: { productId: 7, productSlug: 'mug', minQuantity, rfqContext },
  })
}

describe('product_quote_actions.vue', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ajoute le produit au panier à la quantité minimale par défaut', async () => {
    user = { id: 1 }
    const wrapper = mountActions({ canCreateRfq: true, inCart: false })

    expect((wrapper.find('input[type="number"]').element as HTMLInputElement).value).toBe('50')
    await wrapper.find('form').trigger('submit')

    expect(router.post).toHaveBeenCalledWith(
      '/fr/quote_cart.items.store',
      { productId: 7, quantity: 50 },
      { preserveScroll: true, onFinish: expect.any(Function) }
    )
    // Le formulaire complet reste accessible, pré-rempli avec ce produit.
    expect(wrapper.find('a[href="/fr/rfqs.create?productId=7"]').text()).toContain(
      'Demande détaillée'
    )
  })

  it('envoie la quantité saisie', async () => {
    user = { id: 1 }
    const wrapper = mountActions({ canCreateRfq: true, inCart: false }, null)

    await wrapper.find('input[type="number"]').setValue('250')
    await wrapper.find('form').trigger('submit')

    expect(router.post).toHaveBeenCalledWith(
      '/fr/quote_cart.items.store',
      { productId: 7, quantity: 250 },
      expect.anything()
    )
  })

  it('renvoie vers le panier quand le produit y est déjà', () => {
    user = { id: 1 }
    const wrapper = mountActions({ canCreateRfq: true, inCart: true })

    expect(wrapper.text()).toContain('Dans votre panier de devis')
    expect(wrapper.find('a[href="/fr/quote_cart.show"]').text()).toContain('Voir le panier')
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('renvoie un visiteur anonyme vers la connexion, avec retour sur la fiche', async () => {
    user = undefined
    const wrapper = mountActions({ canCreateRfq: false, inCart: false })

    expect(wrapper.text()).toContain('Se connecter pour demander un devis')
    await wrapper.find('button').trigger('click')

    expect(router.get).toHaveBeenCalledWith('/fr/session.create', {
      redirect: '/fr/products/mug',
    })
  })

  it("n'affiche rien à un utilisateur connecté qui ne peut pas demander de devis", () => {
    user = { id: 1 }
    const wrapper = mountActions({ canCreateRfq: false, inCart: false })

    expect(wrapper.find('button').exists()).toBe(false)
  })
})
