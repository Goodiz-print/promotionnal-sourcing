import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { RfqProductOptionType } from '#shared/types/rfq'

const translations = {
  'rfq.product.label': 'Ajouter un produit du catalogue',
  'rfq.product.placeholder': 'Rechercher un produit par son nom…',
  'rfq.product.empty': 'Aucun produit trouvé.',
  'rfq.product.add': 'Ajouter',
}

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return { usePage: () => m.inertiaPage(translations), router: { reload: vi.fn() } }
})

const { default: RfqProductPicker } = await import('~/components/rfqs/rfq_product_picker.vue')
const { router } = await import('@inertiajs/vue3')

const tote: RfqProductOptionType = {
  id: 12,
  slug: 'tote-bag',
  name: 'Tote bag coton',
  categoryId: 3,
  minQuantity: 100,
  supplierName: 'Acme',
  supplierOrganizationId: 9,
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(router.reload).mockReset()
  // Le serveur répond aussitôt : Inertia appelle `onSuccess` avec la page.
  vi.mocked(router.reload).mockImplementation((options) => {
    options?.onSuccess?.({} as never)
  })
})
afterEach(() => vi.useRealTimers())

describe('rfq_product_picker.vue', () => {
  it('recherche par partial reload, après un court délai', async () => {
    const wrapper = mount(RfqProductPicker)

    await wrapper.find('input').setValue('tote')
    expect(router.reload).not.toHaveBeenCalled()

    vi.advanceTimersByTime(300)
    expect(router.reload).toHaveBeenCalledWith({
      data: { productSearch: 'tote' },
      only: ['productResults'],
      preserveUrl: true,
      onSuccess: expect.any(Function),
    })
  })

  it("n'interroge pas le serveur sous deux caractères", async () => {
    const wrapper = mount(RfqProductPicker)

    await wrapper.find('input').setValue('t')
    vi.advanceTimersByTime(300)

    expect(router.reload).not.toHaveBeenCalled()
  })

  it('liste les résultats et émet le produit choisi', async () => {
    const wrapper = mount(RfqProductPicker, { props: { results: [tote] } })
    await wrapper.find('input').setValue('tote')
    await vi.advanceTimersByTimeAsync(300)

    expect(wrapper.text()).toContain('Tote bag coton')
    expect(wrapper.text()).toContain('Acme')

    await wrapper.findAll('button')[0].trigger('click')

    expect(wrapper.emitted('pick')).toEqual([[tote]])
  })

  it("signale l'absence de résultat", async () => {
    const wrapper = mount(RfqProductPicker, { props: { results: [] } })
    await wrapper.find('input').setValue('zzz')
    await vi.advanceTimersByTimeAsync(300)

    expect(wrapper.text()).toContain('Aucun produit trouvé.')
  })

  it("n'affiche pas les résultats d'une saisie précédente pendant la recherche", async () => {
    // Le serveur ne répond pas : `onSuccess` n'est jamais appelé.
    vi.mocked(router.reload).mockImplementation(() => {})
    const wrapper = mount(RfqProductPicker, { props: { results: [tote] } })

    await wrapper.find('input').setValue('tote')
    await vi.advanceTimersByTimeAsync(300)

    expect(wrapper.text()).not.toContain('Tote bag coton')
  })

  it('masque la liste une fois un produit choisi', async () => {
    const wrapper = mount(RfqProductPicker, { props: { results: [tote] } })
    await wrapper.find('input').setValue('tote')
    await vi.advanceTimersByTimeAsync(300)

    await wrapper.findAll('button')[0].trigger('click')

    expect(wrapper.text()).not.toContain('Tote bag coton')
  })
})
