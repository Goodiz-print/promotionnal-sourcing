import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { answerConfirm, confirmText, mountConfirmHost } from './support/confirm_dialog'
import { CONTENT_LOCALES, type ContentLocale } from '#shared/types/i18n'
import type { CertificationAdminType, CertificationEditType } from '#shared/types/certification'

const translations: Record<string, string> = {
  'certifications.index.title': 'Certifications',
  'certifications.index.subtitle': 'Administrez les labels.',
  'certifications.index.empty': 'Aucune certification pour le moment.',
  'certifications.index.emptyDescription': 'Les certifications renseignent les acheteurs.',
  'certifications.index.columns.name': 'Nom',
  'certifications.index.columns.slug': 'Identifiant',
  'certifications.index.columns.domain': 'Domaine',
  'certifications.index.columns.isEco': 'Éco-label',
  'certifications.index.columns.products': 'Produits',
  'certifications.index.columns.actions': 'Actions',
  'certifications.index.yes': 'Oui',
  'certifications.index.no': 'Non',
  'certifications.domains.environment': 'Environnement',
  'certifications.domains.textile': 'Textile',
  'certifications.domains.social': 'Social',
  'certifications.domains.safety': 'Sécurité',
  'certifications.domains.food_contact': 'Contact alimentaire',
  'certifications.domains.forestry': 'Foresterie',
  'certifications.domains.quality': 'Qualité',
  'certifications.newCertification': 'Nouvelle certification',
  'certifications.edit': 'Modifier',
  'certifications.delete': 'Supprimer',
  'certifications.save': 'Enregistrer',
  'certifications.cancel': 'Annuler',
  'certifications.confirmDelete': 'Supprimer cette certification ?',
  'certifications.create.title': 'Nouvelle certification',
  'certifications.create.subtitle': 'Ajoutez un label.',
  'certifications.update.title': 'Modifier la certification',
  'certifications.update.subtitle': 'Modifiez « {slug} ».',
  'certifications.back': 'Retour',
  'certifications.fields.slug': 'Identifiant (slug)',
  'certifications.fields.domain': 'Domaine',
  'certifications.fields.isEco': 'Éco-label',
  'certifications.fields.synonyms': 'Synonymes',
  'certifications.fields.name': 'Nom',
  'certifications.form.identity': 'Identification',
  'certifications.form.content': 'Contenu en {language}',
  'certifications.form.otherLocale': 'Autre langue',
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

const { default: Index } = await import('~/pages/admin/certifications/index.vue')
const { default: Create } = await import('~/pages/admin/certifications/create.vue')
const { default: Edit } = await import('~/pages/admin/certifications/edit.vue')

function certification(extra: Partial<CertificationAdminType> = {}): CertificationAdminType {
  return {
    id: 1,
    slug: 'oeko-tex-100',
    name: 'OEKO-TEX 100',
    domain: 'textile',
    isEco: true,
    productsCount: 4,
    ...extra,
  }
}

/** Une entrée de nom par langue de contenu, seules les langues données sont renseignées. */
function names(filled: Partial<Record<ContentLocale, string>>) {
  return Object.fromEntries(
    CONTENT_LOCALES.map((locale) => [locale, { name: filled[locale] ?? '', isAuto: false }])
  ) as CertificationEditType['translations']
}

function editable(): CertificationEditType {
  return {
    id: 7,
    slug: 'fsc',
    domain: 'forestry',
    isEco: true,
    synonyms: ['FSC Mix', 'FSC 100'],
    sourceLocale: 'fr',
    translations: names({ fr: 'FSC', en: 'FSC EN' }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  transformer = null
})

describe('admin/certifications/index.vue', () => {
  it('liste les certifications avec domaine, éco et nombre de produits', () => {
    const wrapper = mount(Index, { props: { certifications: [certification()] } })

    expect(wrapper.text()).toContain('OEKO-TEX 100')
    expect(wrapper.text()).toContain('oeko-tex-100')
    expect(wrapper.text()).toContain('Textile')
    expect(wrapper.text()).toContain('Oui')
    expect(wrapper.text()).toContain('4')
    expect(wrapper.text()).toContain('Nouvelle certification')
  })

  it('affiche un état vide', () => {
    const wrapper = mount(Index, { props: { certifications: [] } })
    expect(wrapper.text()).toContain('Aucune certification pour le moment.')
  })

  it('supprime après confirmation', async () => {
    const host = await mountConfirmHost()
    const wrapper = mount(Index, { props: { certifications: [certification()] } })

    await wrapper.find('button[aria-label="Supprimer"]').trigger('click')
    expect(confirmText(host)).toBe('Supprimer cette certification ?')
    await answerConfirm(host, 'confirm')

    expect(del).toHaveBeenCalledWith(
      '/fr/admin.certifications.destroy/1',
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('ne supprime pas si la confirmation est refusée', async () => {
    const host = await mountConfirmHost()
    const wrapper = mount(Index, { props: { certifications: [certification()] } })

    await wrapper.find('button[aria-label="Supprimer"]').trigger('click')
    await answerConfirm(host, 'cancel')

    expect(del).not.toHaveBeenCalled()
  })
})

describe('admin/certifications/create.vue', () => {
  it('propose tous les domaines et envoie le slug en POST', async () => {
    const wrapper = mount(Create)

    expect(wrapper.findAll('#domain option')).toHaveLength(7)
    expect(wrapper.find('#domain').text()).toContain('Contact alimentaire')

    await wrapper.find('#slug').setValue('nouveau-label')
    await wrapper.find('#name-fr').setValue('Nouveau label')
    await wrapper.find('form').trigger('submit')

    expect(post).toHaveBeenCalledWith(
      '/fr/admin.certifications.store',
      expect.objectContaining({ preserveScroll: true })
    )
    const payload = transformer!({
      slug: 'nouveau-label',
      domain: 'environment',
      isEco: false,
      synonyms: 'a, b, ',
      translations: names({ fr: 'Nouveau label' }),
    })
    expect(payload).toMatchObject({
      slug: 'nouveau-label',
      synonyms: ['a', 'b'],
      sourceLocale: 'fr',
    })
  })
})

describe('admin/certifications/edit.vue', () => {
  it('fige le slug et envoie un PATCH sans slug', async () => {
    const wrapper = mount(Edit, { props: { certification: editable() } })

    expect(wrapper.find('#slug').exists()).toBe(false)
    expect((wrapper.find('#name-fr').element as HTMLInputElement).value).toBe('FSC')
    expect((wrapper.find('#synonyms').element as HTMLInputElement).value).toBe('FSC Mix, FSC 100')

    await wrapper.find('form').trigger('submit')

    expect(patch).toHaveBeenCalledWith(
      '/fr/admin.certifications.update/7',
      expect.objectContaining({ preserveScroll: true })
    )
    const payload = transformer!({
      slug: 'fsc',
      domain: 'forestry',
      isEco: true,
      synonyms: 'FSC Mix',
      translations: names({ fr: 'FSC' }),
    })
    expect(payload).not.toHaveProperty('slug')
    expect(payload.translations).toEqual({ fr: { name: 'FSC' } })
  })
})
