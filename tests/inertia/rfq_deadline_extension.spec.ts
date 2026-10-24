import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

const translations = {
  'rfq.deadline.label': 'Nouvelle échéance',
  'rfq.deadline.extend': "Prolonger l'échéance",
  'rfq.deadline.expiredNotice': 'Cette demande est échue.',
}

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return { usePage: () => m.inertiaPage(translations), router: { patch: vi.fn() } }
})
vi.mock('~/client', () => ({
  urlFor: (_route: string, params: { id: number }) => `/fr/rfqs/${params.id}/deadline`,
}))

const { default: RfqDeadlineExtension } =
  await import('~/components/rfqs/rfq_deadline_extension.vue')
const { router } = await import('@inertiajs/vue3')

beforeEach(() => vi.mocked(router.patch).mockClear())

describe('rfq_deadline_extension.vue', () => {
  it("n'envoie rien tant qu'aucune date n'est choisie", () => {
    const wrapper = mount(RfqDeadlineExtension, {
      props: { rfq: { id: 4, status: 'published', deadline: null } },
    })

    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).not.toContain('Cette demande est échue.')
  })

  it('prolonge l’échéance par un PATCH, sans toucher à autre chose', async () => {
    const wrapper = mount(RfqDeadlineExtension, {
      props: { rfq: { id: 4, status: 'published', deadline: '2026-11-05T00:00:00.000Z' } },
    })

    await wrapper.find('input[type="date"]').setValue('2026-12-01')
    await wrapper.find('button').trigger('click')

    expect(router.patch).toHaveBeenCalledWith(
      '/fr/rfqs/4/deadline',
      { deadline: '2026-12-01' },
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('explique qu’une demande échue se rouvre en prolongeant', () => {
    const wrapper = mount(RfqDeadlineExtension, {
      props: { rfq: { id: 4, status: 'expired', deadline: '2026-10-20T00:00:00.000Z' } },
    })

    expect(wrapper.text()).toContain('Cette demande est échue.')
  })
})
