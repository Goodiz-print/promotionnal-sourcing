import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { CategoryAttributeEditType, CategoryAttributeOption } from '#shared/types/category'

const translations: Record<string, string> = {
  'categories.attributes.title': 'Attributs associés',
  'categories.attributes.description': 'Attributs rattachés.',
  'categories.attributes.empty': 'Aucun attribut associé.',
  'categories.attributes.add': 'Ajouter un attribut',
  'categories.attributes.columns.name': 'Attribut',
  'categories.attributes.columns.type': 'Type',
  'categories.attributes.columns.required': 'Obligatoire',
  'categories.attributes.columns.filter': 'Filtre',
  'categories.attributes.columns.position': 'Position',
  'categories.attributes.columns.ranges': 'Plages',
  'categories.attributes.columns.actions': 'Actions',
  'categories.attributes.selectLabel': 'Attribut à ajouter',
  'categories.attributes.selectPlaceholder': 'Choisir un attribut',
  'categories.attributes.noneAvailable': 'Tous les attributs sont associés.',
  'categories.attributes.remove': "Retirer l'attribut",
  'categories.attributes.confirmRemove': 'Retirer cet attribut ?',
  'categories.attributes.editRanges': 'Modifier les plages',
  'categories.attributes.noRanges': 'Aucune plage',
  'categories.attributes.requiredFor': 'Obligatoire pour {name}',
  'categories.attributes.filterFor': 'Filtre pour {name}',
  'categories.attributes.positionFor': 'Position de {name}',
  'categories.attributes.ranges.min': 'Minimum',
  'categories.attributes.ranges.max': 'Maximum',
  'categories.attributes.ranges.add': 'Ajouter une plage',
  'categories.attributes.ranges.remove': 'Supprimer la plage',
  'categories.attributes.ranges.save': 'Enregistrer les plages',
  'categories.attributes.ranges.hint': 'Laissez une borne vide pour une plage ouverte.',
  'attributes.types.string': 'Texte',
  'attributes.types.number': 'Nombre',
  'attributes.types.boolean': 'Oui / non',
  'attributes.types.enum': 'Liste de valeurs',
}

const post = vi.fn()
const patch = vi.fn()
const routerPatch = vi.fn()
const routerDelete = vi.fn()
let transformer: ((data: Record<string, unknown>) => Record<string, unknown>) | null = null

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    useForm: m.makeUseForm({
      post,
      patch,
      transform(fn: (data: Record<string, unknown>) => Record<string, unknown>) {
        transformer = fn
        return this
      },
    }),
    router: {
      patch: (...args: unknown[]) => routerPatch(...args),
      delete: (...args: unknown[]) => routerDelete(...args),
    },
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({
  urlFor: (name: string, params: { categoryId?: number; id?: number }) =>
    `/fr/${name}/${params.categoryId ?? ''}/${params.id ?? ''}`,
}))

const { default: Section } =
  await import('~/components/categories/attributes/category_attributes_section.vue')

function pivot(extra: Partial<CategoryAttributeEditType> = {}): CategoryAttributeEditType {
  return {
    id: 11,
    attributeId: 5,
    slug: 'material',
    name: 'Matière',
    type: 'enum',
    unit: null,
    isRequiredForPublication: false,
    isFilter: true,
    position: 2,
    ranges: [],
    ...extra,
  }
}

const numeric = () =>
  pivot({
    id: 12,
    attributeId: 6,
    slug: 'capacity',
    name: 'Contenance',
    type: 'number',
    unit: 'ml',
    ranges: [
      { id: 1, minValue: null, maxValue: 400, position: 0 },
      { id: 2, minValue: 400, maxValue: 600, position: 1 },
      { id: 3, minValue: 900, maxValue: null, position: 2 },
    ],
  })

const available: CategoryAttributeOption[] = [
  { id: 8, slug: 'color', name: 'Couleur' },
  { id: 9, slug: 'weight', name: null },
]

function mountSection(attributes: CategoryAttributeEditType[], options = available) {
  return mount(Section, {
    props: { categoryId: 4, attributes, availableAttributes: options },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  transformer = null
})

describe('CategoryAttributesSection', () => {
  it('liste les attributs associés avec type, bascules et plages', () => {
    const wrapper = mountSection([pivot(), numeric()])

    expect(wrapper.text()).toContain('Matière')
    expect(wrapper.text()).toContain('Liste de valeurs')
    expect(wrapper.text()).toContain('Contenance')
    expect(wrapper.text()).toContain('< 400 ml')
    expect(wrapper.text()).toContain('400 – 600 ml')
    expect(wrapper.text()).toContain('> 900 ml')
    expect((wrapper.find('#attribute-11-filter').element as HTMLInputElement).checked).toBe(true)
    expect((wrapper.find('#attribute-11-required').element as HTMLInputElement).checked).toBe(false)
  })

  it('affiche un état vide', () => {
    const wrapper = mountSection([])
    expect(wrapper.text()).toContain('Aucun attribut associé.')
  })

  it('bascule « obligatoire » via un PATCH Inertia', async () => {
    const wrapper = mountSection([pivot()])

    await wrapper.find('#attribute-11-required').setValue(true)

    expect(routerPatch).toHaveBeenCalledWith(
      '/fr/admin.categories.attributes.update/4/11',
      { isRequiredForPublication: true },
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('bascule « filtre » via un PATCH Inertia', async () => {
    const wrapper = mountSection([pivot()])

    await wrapper.find('#attribute-11-filter').setValue(false)

    expect(routerPatch).toHaveBeenCalledWith(
      '/fr/admin.categories.attributes.update/4/11',
      { isFilter: false },
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('modifie la position', async () => {
    const wrapper = mountSection([pivot()])

    await wrapper.find('#attribute-11-position').setValue('5')
    await wrapper.find('#attribute-11-position').trigger('change')

    expect(routerPatch).toHaveBeenCalledWith(
      '/fr/admin.categories.attributes.update/4/11',
      { position: 5 },
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('retire un attribut après confirmation', async () => {
    window.confirm = vi.fn(() => true)
    const wrapper = mountSection([pivot()])

    await wrapper.find('button[aria-label="Retirer l\'attribut"]').trigger('click')

    expect(routerDelete).toHaveBeenCalledWith(
      '/fr/admin.categories.attributes.destroy/4/11',
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('ne retire rien si la confirmation est refusée', async () => {
    window.confirm = vi.fn(() => false)
    const wrapper = mountSection([pivot()])

    await wrapper.find('button[aria-label="Retirer l\'attribut"]').trigger('click')

    expect(routerDelete).not.toHaveBeenCalled()
  })

  it('ajoute un attribut parmi ceux non associés', async () => {
    const wrapper = mountSection([pivot()])

    expect(wrapper.findAll('#category-attribute-new option')).toHaveLength(3)
    await wrapper.find('#category-attribute-new').setValue('8')
    await wrapper.find('form').trigger('submit')

    expect(post).toHaveBeenCalledWith(
      '/fr/admin.categories.attributes.store/4/',
      expect.objectContaining({ preserveScroll: true })
    )
    expect(transformer!({ attributeId: '8' })).toEqual({ attributeId: 8 })
  })

  it("indique que tout est déjà associé quand il n'y a plus d'attribut à ajouter", () => {
    const wrapper = mountSection([pivot()], [])
    expect(wrapper.text()).toContain('Tous les attributs sont associés.')
    expect(wrapper.find('#category-attribute-new').exists()).toBe(false)
  })

  it("n'offre l'éditeur de plages que pour les attributs numériques", () => {
    const wrapper = mountSection([pivot(), numeric()])
    expect(wrapper.findAll('button[aria-label="Modifier les plages"]')).toHaveLength(1)
  })

  it('édite les plages : bornes ouvertes envoyées en null', async () => {
    const wrapper = mountSection([numeric()])

    await wrapper.find('button[aria-label="Modifier les plages"]').trigger('click')
    expect(wrapper.findAll('#range-12-0-min')).toHaveLength(1)

    // Première plage « < 400 » : minimum vide.
    expect((wrapper.find('#range-12-0-min').element as HTMLInputElement).value).toBe('')
    expect((wrapper.find('#range-12-0-max').element as HTMLInputElement).value).toBe('400')

    const addButton = wrapper.findAll('button').find((b) => b.text() === 'Ajouter une plage')!
    await addButton.trigger('click')
    await wrapper.find('#range-12-3-min').setValue('1000')

    const form = wrapper.findAll('form').find((f) => f.find('#range-12-0-min').exists())!
    await form.trigger('submit')

    expect(patch).toHaveBeenCalledWith(
      '/fr/admin.categories.attributes.ranges.update/4/12',
      expect.objectContaining({ preserveScroll: true })
    )
    const payload = transformer!({
      ranges: [
        { minValue: '', maxValue: '400' },
        { minValue: '1000', maxValue: '' },
        { minValue: '', maxValue: '' },
      ],
    })
    expect(payload).toEqual({
      ranges: [
        { minValue: null, maxValue: 400 },
        { minValue: 1000, maxValue: null },
      ],
    })
  })
})
