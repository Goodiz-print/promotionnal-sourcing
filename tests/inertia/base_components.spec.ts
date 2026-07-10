import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseInput from '~/components/base_input.vue'
import BaseButton from '~/components/base_button.vue'

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
