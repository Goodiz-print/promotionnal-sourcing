import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

const translations = {
  'organization.danger.title': 'Zone de danger',
  'organization.danger.subtitle': 'Ces actions engagent toute l’organisation.',
  'organization.leave.title': 'Quitter cette organisation',
  'organization.leave.description': "Vous perdez l'accès à ses données.",
  'organization.leave.submit': 'Quitter',
  'organization.leave.confirm': 'Quitter cette organisation ?',
  'organization.archive.title': 'Archiver cette organisation',
  'organization.archive.description': 'Elle disparaît du catalogue public.',
  'organization.archive.submit': 'Archiver',
  'organization.archive.confirm': 'Archiver Acme ?',
}

const destroy = vi.fn()
const post = vi.fn()

vi.mock('@inertiajs/vue3', () => ({
  usePage: () => ({ props: { locale: 'fr', supportedLocales: ['fr', 'en'], translations } }),
  router: {
    delete: (...args: unknown[]) => destroy(...args),
    post: (...args: unknown[]) => post(...args),
  },
}))

vi.mock('~/client', () => ({ urlFor: (name: string) => `/fr/${name}` }))

const { default: DangerZone } = await import('~/components/organization/settings/danger_zone.vue')

function button(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper.findAll('button').find((candidate) => candidate.text() === label)
}

describe('DangerZone', () => {
  beforeEach(() => {
    destroy.mockClear()
    post.mockClear()
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
  })

  it("masque le départ quand l'utilisateur ne peut pas quitter", () => {
    const wrapper = mount(DangerZone, {
      props: { organizationName: 'Acme', canLeave: false },
    })

    expect(button(wrapper, 'Quitter')).toBeUndefined()
    expect(button(wrapper, 'Archiver')).toBeDefined()
  })

  it('poste le départ après confirmation', async () => {
    const wrapper = mount(DangerZone, { props: { organizationName: 'Acme', canLeave: true } })

    await button(wrapper, 'Quitter')!.trigger('click')

    expect(destroy).toHaveBeenCalledWith('/fr/organization.leave', { preserveScroll: true })
  })

  it('ne fait rien si la confirmation est refusée', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
    const wrapper = mount(DangerZone, { props: { organizationName: 'Acme', canLeave: true } })

    await button(wrapper, 'Quitter')!.trigger('click')
    await button(wrapper, 'Archiver')!.trigger('click')

    expect(destroy).not.toHaveBeenCalled()
    expect(post).not.toHaveBeenCalled()
  })

  it("poste l'archivage après confirmation", async () => {
    const wrapper = mount(DangerZone, { props: { organizationName: 'Acme', canLeave: true } })

    await button(wrapper, 'Archiver')!.trigger('click')

    expect(post).toHaveBeenCalledWith('/fr/organization.archive', {}, { preserveScroll: true })
  })
})
