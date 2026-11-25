import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { RfqItemType } from '#shared/types/rfq'

const translations = {
  'rfq.show.category': 'Catégorie',
  'rfq.show.product': 'Produit',
  'rfq.show.viewProduct': 'Voir le produit',
  'rfq.specs.variant': 'Variante',
  'rfq.specs.markingTechnique': 'Technique de marquage',
  'rfq.specs.estimatedTotal': 'Total indicatif',
}

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return { usePage: () => m.inertiaPage(translations) }
})
vi.mock('@adonisjs/inertia/vue', () => ({ Link: { template: '<a><slot /></a>' } }))

const { default: RfqItemList } = await import('~/components/rfqs/rfq_item_list.vue')

const item = (specs: RfqItemType['specs']): RfqItemType => ({
  id: 1,
  name: 'Mug céramique',
  description: null,
  quantity: 250,
  unit: null,
  categoryId: null,
  categoryName: null,
  productId: null,
  productName: null,
  productSlug: null,
  specs,
})

describe('rfq_item_list.vue', () => {
  it('affiche les précisions transmises par le panier de devis, libellées', () => {
    const wrapper = mount(RfqItemList, {
      props: {
        items: [
          item({
            variant: 'Rouge · L',
            markingTechnique: 'Tampographie',
            estimatedTotal: '512.50 EUR',
            custom: 'valeur libre',
          }),
        ],
      },
    })

    const specs = wrapper.find('[data-testid="rfq-item-specs"]')
    expect(specs.text()).toContain('VarianteRouge · L')
    expect(specs.text()).toContain('Technique de marquageTampographie')
    expect(specs.text()).toContain('Total indicatif512.50 EUR')
    // Clé inconnue : affichée telle quelle.
    expect(specs.text()).toContain('customvaleur libre')
  })

  it("n'affiche rien sans précision", () => {
    const wrapper = mount(RfqItemList, { props: { items: [item(null), { ...item({}), id: 2 }] } })

    expect(wrapper.find('[data-testid="rfq-item-specs"]').exists()).toBe(false)
  })
})
