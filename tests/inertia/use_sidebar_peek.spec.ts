import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { SIDEBAR_PEEK_DELAY_MS, useSidebarPeek } from '~/composables/use_sidebar_peek'

const Probe = defineComponent({
  setup() {
    const { peeking, enter, leave } = useSidebarPeek()
    return () =>
      h('aside', {
        'data-peeking': String(peeking.value),
        'onMouseenter': enter,
        'onMouseleave': leave,
      })
  },
})

describe('useSidebarPeek', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('déplie le menu après un court survol et le replie à la sortie du pointeur', async () => {
    const wrapper = mount(Probe)
    const aside = wrapper.get('aside')

    await aside.trigger('mouseenter')
    expect(aside.attributes('data-peeking')).toBe('false')

    vi.advanceTimersByTime(SIDEBAR_PEEK_DELAY_MS)
    await wrapper.vm.$nextTick()
    expect(aside.attributes('data-peeking')).toBe('true')

    await aside.trigger('mouseleave')
    expect(aside.attributes('data-peeking')).toBe('false')
  })

  it('ne déplie pas le menu quand le pointeur ne fait que le traverser', async () => {
    const wrapper = mount(Probe)
    const aside = wrapper.get('aside')

    await aside.trigger('mouseenter')
    vi.advanceTimersByTime(SIDEBAR_PEEK_DELAY_MS - 50)
    await aside.trigger('mouseleave')
    vi.advanceTimersByTime(SIDEBAR_PEEK_DELAY_MS)
    await wrapper.vm.$nextTick()

    expect(aside.attributes('data-peeking')).toBe('false')
  })
})
