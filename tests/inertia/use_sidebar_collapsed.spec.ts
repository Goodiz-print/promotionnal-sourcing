import { describe, it, expect, beforeEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useSidebarCollapsed } from '~/composables/use_sidebar_collapsed'

const Probe = defineComponent({
  setup() {
    const { collapsed } = useSidebarCollapsed()
    return () => h('p', { 'data-collapsed': String(collapsed.value) })
  },
})

describe('useSidebarCollapsed', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('rend déplié au premier rendu, puis applique le choix mémorisé une fois monté', async () => {
    window.localStorage.setItem('app-sidebar-collapsed', '1')
    const wrapper = mount(Probe)

    await wrapper.vm.$nextTick()

    expect(wrapper.get('p').attributes('data-collapsed')).toBe('true')
  })

  it('reste déplié sans choix mémorisé', async () => {
    const wrapper = mount(Probe)

    await wrapper.vm.$nextTick()

    expect(wrapper.get('p').attributes('data-collapsed')).toBe('false')
  })
})
