import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const translations = {
  'landing.contact.fieldName': 'Nom et prénom',
  'landing.contact.fieldCompany': 'Société',
  'landing.contact.fieldEmail': 'E-mail professionnel',
  'landing.contact.fieldPhone': 'Téléphone',
  'landing.contact.fieldPhoneOptional': 'facultatif',
  'landing.contact.fieldType': 'Type de demande',
  'landing.contact.fieldTypeContact': 'Demande de contact',
  'landing.contact.fieldTypePartnership': 'Partenariat fournisseur',
  'landing.contact.fieldMessage': 'Votre besoin',
  'landing.contact.honeypot': 'Ne remplissez pas ce champ',
  'landing.contact.submit': 'Envoyer ma demande',
  'landing.contact.requiredHint': 'Les champs marqués (*) sont obligatoires.',
  'landing.contact.privacyBefore': 'Voir notre ',
  'landing.contact.privacyLink': 'politique de confidentialité',
  'landing.contact.privacyAfter': '.',
}

const post = vi.fn()
const errors = vi.hoisted(() => ({ value: {} as Record<string, string> }))

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  const useForm = m.makeUseForm({ post })
  return {
    Head: m.HeadStub,
    usePage: () => m.inertiaPage(translations),
    useForm: (data: Record<string, unknown>) =>
      Object.assign(useForm(data), { errors: errors.value }),
  }
})
vi.mock('@adonisjs/inertia/vue', async () => {
  const { LinkStub } = await import('./support/inertia_mocks')
  return { Link: LinkStub }
})
vi.mock('~/client', () => ({
  urlFor: (route: string, params: { locale: string }) => `/${params.locale}/${route}`,
}))

const { default: ContactForm } = await import('~/components/marketing/contact_form.vue')

describe('marketing/contact_form', () => {
  it('rend les champs du formulaire et le piège anti-robots masqué', () => {
    const wrapper = mount(ContactForm, { props: { initialType: 'contact' } })

    for (const id of ['name', 'company', 'email', 'phone', 'type', 'message']) {
      expect(wrapper.find(`#contact-${id}`).exists()).toBe(true)
    }
    const trap = wrapper.find('input[tabindex="-1"]')
    expect(trap.exists()).toBe(true)
    expect(trap.element.closest('p')?.classList.contains('hidden')).toBe(true)
  })

  it('présélectionne le type de demande reçu du serveur', () => {
    const wrapper = mount(ContactForm, { props: { initialType: 'partnership' } })

    expect((wrapper.find('#contact-type').element as HTMLSelectElement).value).toBe('partnership')
  })

  it('poste vers la route du formulaire dans la locale courante', async () => {
    const wrapper = mount(ContactForm, { props: { initialType: 'contact' } })

    await wrapper.find('form').trigger('submit')

    expect(post).toHaveBeenCalledWith('/fr/marketing.contact.store')
  })

  it("affiche l'erreur de validation renvoyée par le serveur", () => {
    errors.value = { email: 'Adresse e-mail invalide' }
    const wrapper = mount(ContactForm, { props: { initialType: 'contact' } })

    expect(wrapper.text()).toContain('Adresse e-mail invalide')
    expect(wrapper.find('#contact-email').attributes('data-invalid')).toBe('true')
  })
})
