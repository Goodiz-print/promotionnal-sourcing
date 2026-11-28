import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { chooseOption, comboboxOptions } from './support/combobox'

const translations: Record<string, string> = {
  'agency_signup.title': 'Inscription agence',
  'agency_signup.subtitle': 'Deux minutes.',
  'agency_signup.submit': 'Créer mon compte agence',
  'agency_signup.haveAccount': "J'ai déjà un compte",
  'agency_signup.sections.account': 'Vous',
  'agency_signup.sections.company': 'Votre entreprise',
  'agency_signup.sections.consents': 'Consentements',
  'agency_signup.fields.civility': 'Civilité',
  'agency_signup.fields.email': 'E-mail professionnel',
  'agency_signup.fields.companyName': 'Raison sociale',
  'agency_signup.fields.country': 'Pays',
  'agency_signup.fields.taxId': 'Numéro de TVA ou SIRET',
  'agency_signup.fields.website': 'Site web',
  'agency_signup.fields.phone': 'Téléphone',
  'agency_signup.fields.activity': 'Activité',
  'agency_signup.fields.activityOther': 'Précisez votre activité',
  'agency_signup.fields.locale': 'Langue',
  'agency_signup.civility.none': 'Non précisée',
  'agency_signup.civility.madame': 'Madame',
  'agency_signup.civility.monsieur': 'Monsieur',
  'agency_signup.country.placeholder': 'Choisir un pays',
  'agency_signup.activity.placeholder': 'Choisir une activité',
  'agency_signup.activity.other': 'Autre',
  'agency_signup.consents.professional': 'Je certifie être un professionnel',
  'agency_signup.consents.terms': "J'accepte les CGU",
  'agency_signup.consents.partners': 'Newsletter partenaires',
  'auth.fields.firstName': 'Prénom',
  'auth.fields.lastName': 'Nom',
  'auth.fields.password': 'Mot de passe',
  'auth.fields.passwordConfirmation': 'Confirmer le mot de passe',
}

const post = vi.fn()
let lastTransform: ((data: Record<string, unknown>) => Record<string, unknown>) | null = null

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  const useForm = m.makeUseForm({
    post,
    transform(this: unknown, fn: typeof lastTransform) {
      lastTransform = fn
      return this
    },
  })
  return {
    usePage: () => m.inertiaPage(translations),
    useForm,
    Head: m.HeadStub,
  }
})

vi.mock('@adonisjs/inertia/vue', () => ({
  Link: { props: ['route', 'params'], template: '<a :data-route="route"><slot /></a>' },
}))

vi.mock('~/client', () => ({ urlFor: (name: string) => `/fr/${name}` }))

const { default: SignupAgency } = await import('~/pages/auth/signup_agency.vue')

describe('auth/signup_agency.vue', () => {
  it('affiche les trois sections et les champs obligatoires', () => {
    const wrapper = mount(SignupAgency, { props: {} })

    for (const id of [
      'civility',
      'firstName',
      'lastName',
      'email',
      'password',
      'passwordConfirmation',
      'companyName',
      'country',
      'taxId',
      'website',
      'phone',
      'contactEmail',
      'activity',
      'locale',
      'certifiesProfessional',
      'acceptsTerms',
      'acceptsPartnerCommunications',
    ]) {
      expect(wrapper.find(`#${id}`).exists(), id).toBe(true)
    }
  })

  it('liste les pays dans la langue de la page', () => {
    const wrapper = mount(SignupAgency, { props: {} })
    const options = comboboxOptions(wrapper, 'country')

    expect(options).toContain('France')
    expect(options.length).toBeGreaterThan(200)
  })

  it("déduit la langue du pays tant qu'elle n'a pas été choisie", async () => {
    const wrapper = mount(SignupAgency, { props: {} })

    await chooseOption(wrapper, 'country', 'DE')
    expect((wrapper.find('#locale').element as HTMLSelectElement).value).toBe('de')

    await wrapper.find('#locale').setValue('en')
    await chooseOption(wrapper, 'country', 'ES')
    expect((wrapper.find('#locale').element as HTMLSelectElement).value).toBe('en')
  })

  it("n'affiche la précision d'activité que pour « Autre »", async () => {
    const wrapper = mount(SignupAgency, { props: {} })

    expect(wrapper.find('#activityOther').exists()).toBe(false)
    await wrapper.find('#activity').setValue('other')
    expect(wrapper.find('#activityOther').exists()).toBe(true)
  })

  it('envoie les champs facultatifs vides à null', async () => {
    const wrapper = mount(SignupAgency, { props: {} })
    await wrapper.find('form').trigger('submit')

    expect(post).toHaveBeenCalled()
    const sent = lastTransform!({
      civility: '',
      website: '  ',
      phone: '',
      contactEmail: ' ',
      activity: 'distributor_reseller',
      activityOther: 'ignoré',
      locale: 'fr',
      country: 'FR',
    })
    expect(sent).toMatchObject({
      civility: null,
      website: null,
      phone: null,
      contactEmail: null,
      activityOther: null,
    })
  })
})
