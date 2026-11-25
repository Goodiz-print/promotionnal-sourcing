import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { answerConfirm, mountConfirmHost } from './support/confirm_dialog'
import { CONTENT_LOCALES, type ContentLocale } from '#shared/types/i18n'
import type { MarkingTechniqueAdminType, MarkingTechniqueEditType } from '#shared/types/marking'

const translations: Record<string, string> = {
  'markingTechniques.index.title': 'Techniques de marquage',
  'markingTechniques.index.subtitle': 'Administrez les techniques.',
  'markingTechniques.index.empty': 'Aucune technique pour le moment.',
  'markingTechniques.index.emptyDescription': 'Les techniques décrivent la personnalisation.',
  'markingTechniques.index.columns.name': 'Nom',
  'markingTechniques.index.columns.slug': 'Identifiant',
  'markingTechniques.index.columns.family': 'Famille',
  'markingTechniques.index.columns.products': 'Produits',
  'markingTechniques.index.columns.actions': 'Actions',
  'markingTechniques.families.print': 'Impression',
  'markingTechniques.families.transfer': 'Transfert',
  'markingTechniques.families.engraving': 'Gravure',
  'markingTechniques.families.embroidery': 'Broderie',
  'markingTechniques.families.relief': 'Relief',
  'markingTechniques.families.special': 'Spécial',
  'markingTechniques.newTechnique': 'Nouvelle technique',
  'markingTechniques.edit': 'Modifier',
  'markingTechniques.delete': 'Supprimer',
  'markingTechniques.save': 'Enregistrer',
  'markingTechniques.cancel': 'Annuler',
  'markingTechniques.confirmDelete': 'Supprimer cette technique ?',
  'markingTechniques.create.title': 'Nouvelle technique',
  'markingTechniques.create.subtitle': 'Ajoutez une technique.',
  'markingTechniques.update.title': 'Modifier la technique',
  'markingTechniques.update.subtitle': 'Modifiez « {slug} ».',
  'markingTechniques.back': 'Retour',
  'markingTechniques.fields.slug': 'Identifiant (slug)',
  'markingTechniques.fields.family': 'Famille',
  'markingTechniques.fields.synonyms': 'Synonymes',
  'markingTechniques.fields.name': 'Nom',
  'markingTechniques.form.identity': 'Identification',
  'markingTechniques.form.content': 'Contenu en {language}',
  'markingTechniques.form.otherLocale': 'Autre langue',
}

const post = vi.fn()
const patch = vi.fn()
const del = vi.fn()
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
    router: { delete: (...args: unknown[]) => del(...args) },
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({
  urlFor: (name: string, params: { id?: number }) =>
    `/fr/${name}${params.id ? `/${params.id}` : ''}`,
}))
vi.mock('@adonisjs/inertia/vue', async () => {
  const { LinkStub } = await import('./support/inertia_mocks')
  return { Link: LinkStub }
})

const { default: Index } = await import('~/pages/admin/marking_techniques/index.vue')
const { default: Create } = await import('~/pages/admin/marking_techniques/create.vue')
const { default: Edit } = await import('~/pages/admin/marking_techniques/edit.vue')

function technique(extra: Partial<MarkingTechniqueAdminType> = {}): MarkingTechniqueAdminType {
  return {
    id: 1,
    slug: 'serigraphie',
    name: 'Sérigraphie',
    family: 'print',
    productsCount: 12,
    ...extra,
  }
}

/** Une entrée de nom par langue de contenu, seules les langues données sont renseignées. */
function names(filled: Partial<Record<ContentLocale, string>>) {
  return Object.fromEntries(
    CONTENT_LOCALES.map((locale) => [locale, { name: filled[locale] ?? '', isAuto: false }])
  ) as MarkingTechniqueEditType['translations']
}

function editable(): MarkingTechniqueEditType {
  return {
    id: 3,
    slug: 'gravure-laser',
    family: 'engraving',
    synonyms: ['laser'],
    sourceLocale: 'fr',
    translations: names({ fr: 'Gravure laser' }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  transformer = null
})

describe('admin/marking_techniques/index.vue', () => {
  it('liste les techniques avec famille et nombre de produits', () => {
    const wrapper = mount(Index, { props: { techniques: [technique()] } })

    expect(wrapper.text()).toContain('Sérigraphie')
    expect(wrapper.text()).toContain('serigraphie')
    expect(wrapper.text()).toContain('Impression')
    expect(wrapper.text()).toContain('12')
    expect(wrapper.text()).toContain('Nouvelle technique')
  })

  it('affiche un état vide', () => {
    const wrapper = mount(Index, { props: { techniques: [] } })
    expect(wrapper.text()).toContain('Aucune technique pour le moment.')
  })

  it('supprime après confirmation', async () => {
    const host = await mountConfirmHost()
    const wrapper = mount(Index, { props: { techniques: [technique()] } })

    await wrapper.find('button[aria-label="Supprimer"]').trigger('click')
    expect(host.find('#confirm-dialog-message').text()).toBe('Supprimer cette technique ?')
    await answerConfirm(host, 'confirm')

    expect(del).toHaveBeenCalledWith(
      '/fr/admin.marking_techniques.destroy/1',
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('ne supprime pas si la confirmation est refusée', async () => {
    const host = await mountConfirmHost()
    const wrapper = mount(Index, { props: { techniques: [technique()] } })

    await wrapper.find('button[aria-label="Supprimer"]').trigger('click')
    await answerConfirm(host, 'cancel')

    expect(del).not.toHaveBeenCalled()
  })
})

describe('admin/marking_techniques/create.vue', () => {
  it('propose les familles et envoie le slug en POST', async () => {
    const wrapper = mount(Create)

    expect(wrapper.findAll('#family option')).toHaveLength(6)

    await wrapper.find('#slug').setValue('tampographie')
    await wrapper.find('form').trigger('submit')

    expect(post).toHaveBeenCalledWith(
      '/fr/admin.marking_techniques.store',
      expect.objectContaining({ preserveScroll: true })
    )
    const payload = transformer!({
      slug: 'tampographie',
      family: 'print',
      synonyms: 'tampo, pad printing',
      translations: names({ fr: 'Tampographie', en: 'Pad printing' }),
    })
    expect(payload).toMatchObject({
      slug: 'tampographie',
      family: 'print',
      synonyms: ['tampo', 'pad printing'],
      sourceLocale: 'fr',
    })
    expect(payload.translations).toEqual({
      fr: { name: 'Tampographie' },
      en: { name: 'Pad printing' },
    })
  })
})

describe('admin/marking_techniques/edit.vue', () => {
  it('fige le slug et envoie un PATCH sans slug', async () => {
    const wrapper = mount(Edit, { props: { technique: editable() } })

    expect(wrapper.find('#slug').exists()).toBe(false)
    expect((wrapper.find('#name-fr').element as HTMLInputElement).value).toBe('Gravure laser')
    expect((wrapper.find('#family').element as HTMLSelectElement).value).toBe('engraving')

    await wrapper.find('form').trigger('submit')

    expect(patch).toHaveBeenCalledWith(
      '/fr/admin.marking_techniques.update/3',
      expect.objectContaining({ preserveScroll: true })
    )
    const payload = transformer!({
      slug: 'gravure-laser',
      family: 'engraving',
      synonyms: 'laser',
      translations: names({ fr: 'Gravure laser' }),
    })
    expect(payload).not.toHaveProperty('slug')
  })
})
