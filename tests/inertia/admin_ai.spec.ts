import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { AdminAiOverview, AdminAiTranslationRow } from '#shared/types/admin_ai'

const translations = {
  'admin.ai.title': 'IA et traductions',
  'admin.ai.subtitle': 'Traduction automatique avec {model} (version du prompt : {version}).',
  'admin.ai.reviewLink': 'Relire les traductions',
  'admin.ai.disabled': 'La traduction automatique est désactivée.',
  'admin.ai.kpis.calls': 'Appels IA',
  'admin.ai.kpis.window': 'Sur les {days} derniers jours',
  'admin.ai.kpis.failed': 'Échecs',
  'admin.ai.kpis.truncated': 'dont {count} réponses tronquées',
  'admin.ai.kpis.tokens': 'Tokens consommés',
  'admin.ai.kpis.tokensDetail': '{input} en entrée, {output} en sortie',
  'admin.ai.kpis.cost': 'Coût estimé',
  'admin.ai.cost.unknown': '—',
  'admin.ai.cost.estimate': 'D’après le tarif configuré',
  'admin.ai.cost.configure': 'Renseignez le tarif',
  'admin.ai.backfill.title': 'Rattrapage des traductions',
  'admin.ai.backfill.submit': 'Lancer le rattrapage',
  'admin.ai.backfill.all': 'Tous les contenus',
  'admin.ai.coverage.title': 'Couverture par langue',
  'admin.ai.volume.title': 'Volume d’appels',
  'admin.ai.failures.title': 'Derniers échecs',
  'admin.ai.failures.empty': 'Aucun échec enregistré.',
  'admin.ai.statuses.failed': 'Échec',
  'admin.ai.entities.product': 'Produit',
  'admin.ai.origins.auto': 'Générée par l’IA',
  'admin.ai.origins.manual': 'Relue ou saisie',
  'admin.ai.fields.name': 'Nom',
  'admin.ai.translations.title': 'Relecture des traductions',
  'admin.ai.translations.save': 'Enregistrer et valider',
  'admin.ai.translations.empty': 'Aucune traduction.',
}

const post = vi.hoisted(() => vi.fn())
const patch = vi.hoisted(() => vi.fn())
vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    useForm: m.makeUseForm(),
    router: { get: vi.fn(), post, patch },
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({
  urlFor: (name: string, params: Record<string, unknown> = {}) =>
    `/fr/${name}${params.id ? `/${params.id}` : ''}`,
}))
vi.mock('@adonisjs/inertia/vue', async () => {
  const { LinkStub } = await import('./support/inertia_mocks')
  return { Link: LinkStub }
})

import AiIndex from '~/pages/admin/ai/index.vue'
import AiTranslations from '~/pages/admin/ai/translations.vue'

function overview(overrides: Partial<AdminAiOverview> = {}): AdminAiOverview {
  return {
    enabled: true,
    model: 'mistral-small-latest',
    promptVersion: 1,
    pricing: null,
    days: 30,
    totals: {
      calls: 42,
      failed: 3,
      truncated: 1,
      promptTokens: 1000,
      completionTokens: 500,
      estimatedCost: null,
    },
    daily: [{ day: '2026-11-05', calls: 10, failed: 1, tokens: 1500 }],
    coverage: [{ locale: 'fr', total: 10, auto: 0, manual: 10 }],
    failures: [],
    ...overrides,
  }
}

function mountIndex(data: AdminAiOverview) {
  return mount(AiIndex, { props: { overview: data, entities: ['product', 'category'] } })
}

describe('IA et traductions — tableau de bord', () => {
  beforeEach(() => vi.clearAllMocks())

  it('affiche les appels, échecs et tokens de la période', () => {
    const text = mountIndex(overview()).text()

    expect(text).toContain('Appels IA')
    expect(text).toContain('42')
    expect(text).toContain('dont 1 réponses tronquées')
    expect(text).toContain('Renseignez le tarif')
  })

  it('prévient quand la traduction automatique est désactivée et bloque le rattrapage', () => {
    const wrapper = mountIndex(overview({ enabled: false }))

    expect(wrapper.text()).toContain('La traduction automatique est désactivée.')
    const button = wrapper.findAll('button').find((b) => b.text() === 'Lancer le rattrapage')
    expect(button?.attributes('disabled')).toBeDefined()
  })

  it('lance le rattrapage par une visite Inertia', async () => {
    const wrapper = mountIndex(overview())

    await wrapper.find('form').trigger('submit')

    expect(post).toHaveBeenCalledWith('/fr/admin.ai.backfill', {}, expect.any(Object))
  })

  it('liste les derniers échecs avec leur motif', () => {
    const text = mountIndex(
      overview({
        failures: [
          {
            id: 1,
            entity: 'product',
            entityId: 12,
            model: 'mistral-small-latest',
            status: 'failed',
            targetLocales: ['de'],
            error: 'boom',
            createdAt: '2026-11-05T10:00:00.000Z',
          },
        ],
      })
    ).text()

    expect(text).toContain('Produit #12')
    expect(text).toContain('boom')
  })
})

describe('IA et traductions — relecture', () => {
  beforeEach(() => vi.clearAllMocks())

  const row: AdminAiTranslationRow = {
    entity: 'product',
    entityId: 5,
    locale: 'de',
    sourceLocale: 'fr',
    isAuto: true,
    fields: [{ name: 'name', source: 'Stylo', value: 'Kugelschreiber' }],
    updatedAt: '2026-11-05T10:00:00.000Z',
  }

  function mountReview(rows: AdminAiTranslationRow[]) {
    return mount(AiTranslations, {
      props: {
        reviews: {
          data: rows,
          meta: { total: rows.length, perPage: 25, currentPage: 1, lastPage: 1 },
        },
        filters: { entity: 'product', locale: null, origin: 'auto', search: null },
        entities: ['product'],
        locales: ['de'],
        origins: ['auto', 'manual'],
      },
    })
  }

  it('affiche le texte source et la traduction à relire', () => {
    const wrapper = mountReview([row])

    expect(wrapper.text()).toContain('FR — Stylo')
    expect(wrapper.text()).toContain('Générée par l’IA')
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('Kugelschreiber')
  })

  it('enregistre la correction par un PATCH Inertia', async () => {
    const wrapper = mountReview([row])

    await wrapper.find('textarea').setValue('Kuli')
    await wrapper.find('td form').trigger('submit')

    expect(patch).toHaveBeenCalledWith(
      '/fr/admin.ai.translations.correct/5',
      { name: 'Kuli' },
      expect.any(Object)
    )
  })

  it('affiche l’état vide', () => {
    expect(mountReview([]).text()).toContain('Aucune traduction.')
  })
})
