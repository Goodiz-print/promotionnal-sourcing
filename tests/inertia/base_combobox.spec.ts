import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseCombobox from '~/components/base/base_combobox.vue'
import BaseTagPicker from '~/components/base/base_tag_picker.vue'
import { chooseOption, comboboxOptions } from './support/combobox'

const options = [
  { value: 'DE', label: 'Allemagne' },
  { value: 'EC', label: 'Équateur' },
  { value: 'FR', label: 'France' },
]

const labels = {
  placeholder: 'Choisir un pays…',
  searchLabel: 'Rechercher un pays…',
  noResultsLabel: 'Aucun pays trouvé',
}

function mountCombobox(props: Record<string, unknown> = {}) {
  return mount(BaseCombobox, {
    props: { id: 'country', modelValue: null, options, ...labels, ...props },
    attachTo: document.body,
  })
}

describe('base_combobox', () => {
  it('affiche le placeholder sans valeur, le libellé de la valeur sinon', async () => {
    const wrapper = mountCombobox()
    expect(wrapper.find('#country').text()).toBe('Choisir un pays…')

    await wrapper.setProps({ modelValue: 'FR' })
    expect(wrapper.find('#country').text()).toBe('France')
    wrapper.unmount()
  })

  it('ouvre la liste au clic, options cliquables (cursor-pointer)', async () => {
    const wrapper = mountCombobox()
    await wrapper.find('#country').trigger('click')

    expect(wrapper.find('#country').attributes('aria-expanded')).toBe('true')
    const items = wrapper.findAll('[role="option"]')
    expect(items).toHaveLength(3)
    expect(items.every((item) => item.classes().includes('cursor-pointer'))).toBe(true)
    wrapper.unmount()
  })

  it('émet la valeur cliquée et referme la liste', async () => {
    const wrapper = mountCombobox()
    await chooseOption(wrapper, 'country', 'FR')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['FR'])
    expect(wrapper.find('#country').attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('filtre sans tenir compte des accents et signale l’absence de résultat', async () => {
    const wrapper = mountCombobox()
    await wrapper.find('#country').trigger('click')
    const search = wrapper.find('input[role="combobox"]')

    await search.setValue('equa')
    expect(comboboxOptions(wrapper, 'country')).toEqual(['Équateur'])

    await search.setValue('zzz')
    expect(comboboxOptions(wrapper, 'country')).toEqual([])
    expect(wrapper.text()).toContain('Aucun pays trouvé')
    wrapper.unmount()
  })

  it('se pilote au clavier : flèches puis Entrée', async () => {
    const wrapper = mountCombobox()
    await wrapper.find('#country').trigger('click')
    const search = wrapper.find('input[role="combobox"]')

    await search.trigger('keydown', { key: 'ArrowDown' })
    expect(search.attributes('aria-activedescendant')).toBe('country-option-1')
    await search.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['EC'])
    wrapper.unmount()
  })

  it('propose l’option vide qui émet null quand clearLabel est fourni', async () => {
    const wrapper = mountCombobox({ modelValue: 'FR', clearLabel: 'Tous les pays' })
    expect(comboboxOptions(wrapper, 'country')[0]).toBe('Tous les pays')

    await chooseOption(wrapper, 'country', '')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
    wrapper.unmount()
  })

  it('affiche le code quand la valeur ne fait pas partie des options', () => {
    const wrapper = mountCombobox({ modelValue: 'XX' })
    expect(wrapper.find('#country').text()).toBe('XX')
    wrapper.unmount()
  })
})

describe('base_tag_picker', () => {
  function mountPicker(modelValue: string[]) {
    return mount(BaseTagPicker, {
      props: {
        id: 'countries',
        modelValue,
        options,
        ...labels,
        removeLabel: (label: string) => `Retirer ${label}`,
      },
    })
  }

  it('ajoute la valeur choisie et ne propose plus celles déjà prises', async () => {
    const wrapper = mountPicker(['DE'])
    expect(comboboxOptions(wrapper, 'countries')).toEqual(['Équateur', 'France'])

    await chooseOption(wrapper, 'countries', 'FR')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['DE', 'FR']])
  })

  it('retire une valeur au clic sur son badge', async () => {
    const wrapper = mountPicker(['DE', 'FR'])
    await wrapper.find('button[aria-label="Retirer Allemagne"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['FR']])
  })
})
