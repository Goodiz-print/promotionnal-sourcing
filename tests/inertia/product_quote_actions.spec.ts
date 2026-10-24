import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { ProductRfqContextType } from '#shared/types/rfq'

const translations = {
  'products.show.requestQuote': 'Demander un devis',
  'products.show.signInToRequest': 'Se connecter pour demander un devis',
  'products.show.addToDraft': 'Ajouter à une demande en brouillon',
  'products.show.chooseDraft': 'Choisir un brouillon…',
  'rfq.product.add': 'Ajouter',
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
  urlFor: (route: string, params: { id?: number }) =>
    route === 'rfqs.items.from_product'
      ? `/fr/rfqs/${params.id}/items/from-product`
      : `/fr/${route}`,
}))

const { default: ProductQuoteActions } =
  await import('~/components/products/product_quote_actions.vue')
const { router } = await import('@inertiajs/vue3')

function mountActions(rfqContext: ProductRfqContextType) {
  return mount(ProductQuoteActions, { props: { productId: 7, rfqContext } })
}

describe('product_quote_actions.vue', () => {
  it('propose la demande de devis à un acheteur connecté', async () => {
    user = { id: 1 }
    const wrapper = mountActions({ canCreateRfq: true, drafts: [] })

    await wrapper.find('button').trigger('click')

    expect(wrapper.text()).toContain('Demander un devis')
    expect(router.get).toHaveBeenCalledWith('/fr/rfqs.create', { productId: 7 })
    // Aucun brouillon : pas de menu « ajouter à une demande ».
    expect(wrapper.find('select').exists()).toBe(false)
  })

  it('renvoie un visiteur anonyme vers la connexion, avec retour vers le formulaire', async () => {
    user = undefined
    const wrapper = mountActions({ canCreateRfq: false, drafts: [] })

    expect(wrapper.text()).toContain('Se connecter pour demander un devis')
    await wrapper.find('button').trigger('click')

    expect(router.get).toHaveBeenCalledWith('/fr/session.create', {
      redirect: '/fr/rfqs.create?productId=7',
    })
  })

  it("n'affiche rien à un utilisateur connecté qui ne peut pas demander de devis", () => {
    user = { id: 1 }
    const wrapper = mountActions({ canCreateRfq: false, drafts: [] })

    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('ajoute le produit au brouillon choisi', async () => {
    user = { id: 1 }
    const wrapper = mountActions({
      canCreateRfq: true,
      drafts: [
        { id: 3, title: 'Tote bags' },
        { id: 4, title: 'Gourdes' },
      ],
    })
    const add = wrapper.findAll('button')[1]

    // Tant qu'aucun brouillon n'est choisi, l'ajout est désactivé.
    expect(add.attributes('disabled')).toBeDefined()

    await wrapper.find('select').setValue('4')
    await add.trigger('click')

    expect(router.post).toHaveBeenCalledWith(
      '/fr/rfqs/4/items/from-product',
      { productId: 7 },
      { preserveScroll: true }
    )
  })
})
