import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { SUPPORTED_LOCALES } from '#shared/types/i18n'

vi.mock('@inertiajs/vue3', () => ({
  Head: { template: '<div><slot /></div>' },
  usePage: () => ({
    url: '/de/contact?type=partnership',
    props: { locale: 'de', supportedLocales: SUPPORTED_LOCALES, translations: {} },
  }),
}))

import MarketingHead from '~/components/marketing/marketing_head.vue'

describe('marketing_head', () => {
  const wrapper = mount(MarketingHead, {
    props: { title: 'Kontakt', description: 'Beschreibung', siteUrl: 'https://example.test' },
  })

  it('déclare un hreflang pour chacune des langues de l’interface', () => {
    const alternates = wrapper
      .findAll('link[rel="alternate"]')
      .map((link) => [link.attributes('hreflang'), link.attributes('href')])

    for (const code of SUPPORTED_LOCALES) {
      expect(alternates).toContainEqual([code, `https://example.test/${code}/contact`])
    }
    expect(alternates).toContainEqual(['x-default', 'https://example.test/fr/contact'])
  })

  it("pose l'URL canonique dans la langue courante, sans la query", () => {
    expect(wrapper.find('link[rel="canonical"]').attributes('href')).toBe(
      'https://example.test/de/contact'
    )
  })
})
