import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'

describe('Example', () => {
  it('mounts a component', () => {
    const Comp = defineComponent({
      template: '<div>Hello</div>',
    })
    const wrapper = mount(Comp)
    expect(wrapper.text()).toBe('Hello')
  })
})
