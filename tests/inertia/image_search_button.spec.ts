import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const translations = {
  'products.imageSearch.button': 'Rechercher par image',
  'products.imageSearch.analysing': 'Analyse de la photo…',
  'products.imageSearch.hint': 'JPG, PNG ou WebP, 5 Mo max.',
  'products.imageSearch.privacy': 'Analysée par notre prestataire d’IA.',
}

const post = vi.fn()

vi.mock('~/client', () => ({ urlFor: () => '/fr/products/image-search' }))

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    useForm: m.makeUseForm({ post }),
  }
})

const { default: ImageSearchButton } =
  await import('~/components/catalogue/image_search_button.vue')

describe('ImageSearchButton', () => {
  it('affiche le bouton et l’aide sur les formats acceptés', () => {
    const wrapper = mount(ImageSearchButton)

    expect(wrapper.find('button').text()).toContain('Rechercher par image')
    expect(wrapper.text()).toContain('JPG, PNG ou WebP, 5 Mo max.')
    expect(wrapper.find('input[type="file"]').attributes('accept')).toBe('.jpg,.jpeg,.png,.webp')
  })

  it('envoie la photo choisie en multipart', async () => {
    const wrapper = mount(ImageSearchButton)
    const input = wrapper.find('input[type="file"]')
    const file = new File(['x'], 'photo.png', { type: 'image/png' })
    Object.defineProperty(input.element, 'files', { value: [file] })

    await input.trigger('change')

    expect(post).toHaveBeenCalledTimes(1)
    expect(post.mock.calls[0][0]).toContain('/products/image-search')
    expect(post.mock.calls[0][1]).toMatchObject({ forceFormData: true, preserveState: false })
  })
})
