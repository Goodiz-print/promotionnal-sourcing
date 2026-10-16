import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseInput from '~/components/base/base_input.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseRadioGroup from '~/components/base/base_radio_group.vue'

describe('base_input', () => {
  it('rend le label, l’id et le message d’erreur', () => {
    const wrapper = mount(BaseInput, {
      props: { id: 'moq', label: 'Quantité', modelValue: null, error: 'Champ requis' },
    })

    expect(wrapper.find('label[for="moq"]').text()).toBe('Quantité')
    expect(wrapper.find('#moq').exists()).toBe(true)
    expect(wrapper.text()).toContain('Champ requis')
    expect(wrapper.find('#moq').attributes('data-invalid')).toBe('true')
  })

  it('émet une chaîne pour type text', async () => {
    const wrapper = mount(BaseInput, { props: { id: 'x', modelValue: '', type: 'text' } })
    await wrapper.find('input').setValue('ISO 9001')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['ISO 9001'])
  })

  it('coerce en nombre pour type number, et null si vide', async () => {
    const wrapper = mount(BaseInput, { props: { id: 'n', modelValue: null, type: 'number' } })
    const input = wrapper.find('input')

    await input.setValue('42')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([42])

    await input.setValue('')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
  })
})

describe('base_button', () => {
  it('applique le variant primary par défaut et type button', () => {
    const wrapper = mount(BaseButton, { slots: { default: 'Envoyer' } })

    expect(wrapper.get('button').attributes('type')).toBe('button')
    expect(wrapper.get('button').classes()).toContain('bg-[var(--color-primary)]')
    expect(wrapper.text()).toBe('Envoyer')
  })

  it('gère type submit et disabled', () => {
    const wrapper = mount(BaseButton, { props: { type: 'submit', disabled: true } })
    const button = wrapper.get('button')

    expect(button.attributes('type')).toBe('submit')
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('applique le variant link', () => {
    const wrapper = mount(BaseButton, { props: { variant: 'link' } })

    expect(wrapper.get('button').classes()).toContain('text-[var(--color-primary)]')
  })
})

describe('base_radio_group', () => {
  const options = [
    { value: 'buyer', label: 'Acheteur', description: 'desc a' },
    { value: 'supplier', label: 'Fournisseur' },
  ]

  it('rend une option par entrée avec son libellé', () => {
    const wrapper = mount(BaseRadioGroup, { props: { id: 'type', options } })

    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('Acheteur')
    expect(wrapper.text()).toContain('Fournisseur')
    expect(wrapper.text()).toContain('desc a')
  })

  it('émet update:modelValue au changement', async () => {
    const wrapper = mount(BaseRadioGroup, { props: { id: 'type', options } })

    await wrapper.find('#type-supplier').setValue()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['supplier'])
  })

  it('marque l’option sélectionnée', () => {
    const wrapper = mount(BaseRadioGroup, {
      props: { id: 'type', options, modelValue: 'buyer' },
    })

    expect(wrapper.find('label[data-selected="true"]').text()).toContain('Acheteur')
  })
})
