import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

vi.mock('@adonisjs/inertia/vue', () => ({
  Link: defineComponent({
    props: { href: { type: String, default: '' } },
    setup(props, { slots }) {
      return () => h('a', { href: props.href }, slots.default?.())
    },
  }),
}))

import LanguageMenu from '~/components/language_menu.vue'
import { SUPPORTED_LOCALES } from '#shared/types/i18n'

const base = { current: 'fr', locales: SUPPORTED_LOCALES, label: 'Langue' } as const

describe('language_menu', () => {
  it('affiche un drapeau et le nom de chaque langue', () => {
    const wrapper = mount(LanguageMenu, { props: base })

    const options = wrapper.findAll('[role="option"]')
    expect(options).toHaveLength(SUPPORTED_LOCALES.length)
    expect(options.every((option) => option.find('svg').exists())).toBe(true)
    expect(wrapper.text()).toContain('Deutsch')
    expect(wrapper.text()).toContain('Svenska')
  })

  it('émet `select` avec la langue choisie, pas pour la langue courante', async () => {
    const wrapper = mount(LanguageMenu, { props: base })
    const buttons = wrapper.findAll('[role="option"] button')

    await buttons.find((b) => b.text() === 'Deutsch')!.trigger('click')
    expect(wrapper.emitted('select')).toEqual([['de']])

    await buttons.find((b) => b.text() === 'Français')!.trigger('click')
    expect(wrapper.emitted('select')).toHaveLength(1)
  })

  it('rend des liens quand `hrefFor` est fourni', () => {
    const wrapper = mount(LanguageMenu, {
      props: { ...base, hrefFor: (code: string) => `/${code}/contact` },
    })

    const german = wrapper.findAll('[role="option"] a').find((a) => a.text() === 'Deutsch')
    expect(german?.attributes('href')).toBe('/de/contact')
  })
})
