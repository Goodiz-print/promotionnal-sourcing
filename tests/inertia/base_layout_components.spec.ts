import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'

vi.mock('@inertiajs/vue3', () => ({
  usePage: () => ({ url: '/fr', props: {} }),
}))
vi.mock('@adonisjs/inertia/vue', () => ({
  Link: {
    props: ['href'],
    template: '<a :href="href" :aria-current="$attrs[\'aria-current\']"><slot /></a>',
  },
}))

const { default: BasePageHeader } = await import('~/components/base/base_page_header.vue')
const { default: BaseTable } = await import('~/components/base/base_table.vue')
const { default: BaseEmptyState } = await import('~/components/base/base_empty_state.vue')
const { default: BaseTabs } = await import('~/components/base/base_tabs.vue')
const { default: BaseSection } = await import('~/components/base/base_section.vue')
const { default: BaseBadge } = await import('~/components/base/base_badge.vue')
const { default: BaseDropdown } = await import('~/components/base/base_dropdown.vue')

describe('base_page_header', () => {
  it('rend le titre en h1, la description, le lien retour et les actions', () => {
    const wrapper = mount(BasePageHeader, {
      props: { title: 'Mes demandes', description: 'Suivi', backHref: '/fr', backLabel: 'Retour' },
      slots: { actions: '<button>Nouvelle</button>' },
    })

    expect(wrapper.get('h1').text()).toBe('Mes demandes')
    expect(wrapper.get('h1').classes()).toContain('text-display-md')
    expect(wrapper.text()).toContain('Suivi')
    expect(wrapper.get('a').attributes('href')).toBe('/fr')
    expect(wrapper.get('button').text()).toBe('Nouvelle')
  })
})

describe('base_table', () => {
  it('rend thead / tbody / tfoot depuis les slots avec la classe table-base', () => {
    const wrapper = mount(BaseTable, {
      props: { caption: 'Devis' },
      slots: {
        head: '<tr><th scope="col">Titre</th></tr>',
        default: '<tr><td>Tote bags</td></tr>',
        foot: '<tr><td>Total</td></tr>',
      },
    })

    expect(wrapper.get('table').classes()).toContain('table-base')
    expect(wrapper.get('caption').text()).toBe('Devis')
    expect(wrapper.findAll('thead th')).toHaveLength(1)
    expect(wrapper.findAll('tbody td')).toHaveLength(1)
    expect(wrapper.findAll('tfoot td')).toHaveLength(1)
  })

  it('omet thead et tfoot sans slot', () => {
    const wrapper = mount(BaseTable, { slots: { default: '<tr><td>x</td></tr>' } })

    expect(wrapper.find('thead').exists()).toBe(false)
    expect(wrapper.find('tfoot').exists()).toBe(false)
  })
})

describe('base_empty_state', () => {
  it('rend titre, description et actions', () => {
    const wrapper = mount(BaseEmptyState, {
      props: { title: 'Aucune demande', description: 'Créez-en une.' },
      slots: { actions: '<a href="/new">Créer</a>' },
    })

    expect(wrapper.text()).toContain('Aucune demande')
    expect(wrapper.text()).toContain('Créez-en une.')
    expect(wrapper.get('a').attributes('href')).toBe('/new')
    expect(wrapper.find('svg').exists()).toBe(true)
  })
})

describe('base_tabs', () => {
  it("marque l'onglet actif avec aria-current et affiche le compteur", () => {
    const wrapper = mount(BaseTabs, {
      props: {
        label: 'Sections',
        items: [
          { href: '/fr/a', label: 'A', active: false },
          { href: '/fr/b', label: 'B', active: true, count: 3 },
        ],
      },
    })
    const links = wrapper.findAll('a')

    expect(links[0].attributes('aria-current')).toBeUndefined()
    expect(links[1].attributes('aria-current')).toBe('page')
    expect(links[1].text()).toContain('3')
    expect(wrapper.get('nav').attributes('aria-label')).toBe('Sections')
  })
})

describe('base_section', () => {
  it('rend un en-tête h2 et le corps ; en fieldset, le titre devient legend', () => {
    const asSection = mount(BaseSection, {
      props: { title: 'Besoin', description: 'Détail' },
      slots: { default: '<p>corps</p>' },
    })
    expect(asSection.get('h2').text()).toBe('Besoin')
    expect(asSection.text()).toContain('Détail')
    expect(asSection.text()).toContain('corps')

    const asFieldset = mount(BaseSection, { props: { title: 'Identité', as: 'fieldset' } })
    expect(asFieldset.element.tagName).toBe('FIELDSET')
    expect(asFieldset.get('legend').text()).toBe('Identité')
  })
})

describe('base_badge', () => {
  it('applique la tonalité et le point optionnel', () => {
    const wrapper = mount(BaseBadge, {
      props: { tone: 'success', dot: true },
      slots: { default: 'OK' },
    })

    expect(wrapper.classes()).toContain('bg-success-bg')
    expect(wrapper.find('span > span[aria-hidden="true"]').exists()).toBe(true)
    expect(wrapper.text()).toBe('OK')
  })
})

describe('base_dropdown', () => {
  const Host = defineComponent({
    components: { BaseDropdown },
    template: `
      <div>
        <button id="outside">ailleurs</button>
        <BaseDropdown>
          <template #trigger="{ open, toggle }">
            <button id="trigger" :aria-expanded="open" @click="toggle">menu</button>
          </template>
          <template #default="{ close }">
            <button id="item" @click="close">item</button>
          </template>
        </BaseDropdown>
      </div>
    `,
  })

  it("s'ouvre au clic sur le déclencheur et se ferme au clic sur un item, à Échap ou en dehors", async () => {
    const wrapper = mount(Host, { attachTo: document.body })
    const panel = () => wrapper.find('#item').element.parentElement as HTMLElement

    expect(panel().style.display).toBe('none')

    await wrapper.find('#trigger').trigger('click')
    expect(panel().style.display).not.toBe('none')
    expect(wrapper.find('#trigger').attributes('aria-expanded')).toBe('true')

    await wrapper.find('#item').trigger('click')
    expect(panel().style.display).toBe('none')

    await wrapper.find('#trigger').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(panel().style.display).toBe('none')

    await wrapper.find('#trigger').trigger('click')
    document.getElementById('outside')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(panel().style.display).toBe('none')

    wrapper.unmount()
  })
})
