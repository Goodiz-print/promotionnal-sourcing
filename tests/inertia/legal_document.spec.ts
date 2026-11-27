import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const translations = {
  'privacy.sections.responsable.title': 'Responsable',
  'privacy.sections.responsable.body': '<p>Corps responsable</p>',
  'privacy.sections.destinataires.title': 'Destinataires',
  'privacy.sections.destinataires.body': '<p>Mistral AI SAS</p>',
  'privacy.sections.destinataires.bodyClaude': '<p>Anthropic PBC</p>',
}

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return { usePage: () => m.inertiaPage(translations) }
})
vi.mock('@adonisjs/inertia/vue', () => ({ Link: { template: '<a><slot /></a>' } }))
vi.stubGlobal(
  'IntersectionObserver',
  class {
    observe() {}
    disconnect() {}
  }
)

import LegalDocument from '~/components/marketing/legal_document.vue'

const stubs = { GradientMesh: true, BaseLinkButton: true }
const bodies = (bodyKeys?: Record<string, string>) =>
  mount(LegalDocument, {
    props: { doc: 'privacy', sectionIds: ['responsable', 'destinataires'], bodyKeys },
    global: { stubs },
  })
    .findAll('.legal-prose')
    .map((body) => body.text())

describe('legal_document', () => {
  it('affiche le corps `body` de chaque section par défaut', () => {
    expect(bodies()).toEqual(['Corps responsable', 'Mistral AI SAS'])
  })

  it('affiche la variante demandée pour une section, sans toucher aux autres', () => {
    expect(bodies({ destinataires: 'bodyClaude' })).toEqual(['Corps responsable', 'Anthropic PBC'])
  })
})
