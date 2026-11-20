import { test } from '@japa/runner'
import { quoteAddressSource, resolveQuoteAddresses } from '#shared/helpers/quote_address'
import type { RfqMailAddress } from '#shared/types/rfq'

const MEMBERS: RfqMailAddress[] = [
  { email: 'ancien@fournisseur.test', locale: 'de' },
  { email: 'recent@fournisseur.test', locale: 'en' },
]

/** Règle de résolution de l'adresse de réception des demandes (#217). */
test.group('quoteAddressSource / resolveQuoteAddresses', () => {
  test('niveau 1 : l’adresse de réception du profil prime', ({ assert }) => {
    const candidates = {
      quoteEmail: 'devis@fournisseur.test',
      organizationEmail: 'contact@fournisseur.test',
      members: MEMBERS,
    }

    assert.equal(quoteAddressSource(candidates), 'quote_email')
    assert.deepEqual(resolveQuoteAddresses(candidates), [
      { email: 'devis@fournisseur.test', locale: 'de' },
    ])
  })

  test('niveau 2 : à défaut, l’adresse de contact de l’organisation', ({ assert }) => {
    const candidates = {
      quoteEmail: null,
      organizationEmail: 'contact@fournisseur.test',
      members: MEMBERS,
    }

    assert.equal(quoteAddressSource(candidates), 'organization_email')
    assert.deepEqual(resolveQuoteAddresses(candidates), [
      { email: 'contact@fournisseur.test', locale: 'de' },
    ])
  })

  test('niveau 3 : sinon, chaque membre responsable dans sa langue', ({ assert }) => {
    const candidates = { quoteEmail: null, organizationEmail: null, members: MEMBERS }

    assert.equal(quoteAddressSource(candidates), 'members')
    assert.deepEqual(resolveQuoteAddresses(candidates), MEMBERS)
  })

  test('une adresse vide ou faite d’espaces compte comme absente', ({ assert }) => {
    const candidates = { quoteEmail: '  ', organizationEmail: '', members: MEMBERS }

    assert.equal(quoteAddressSource(candidates), 'members')
  })

  test('une adresse explicite sans membre prend la langue par défaut', ({ assert }) => {
    const candidates = {
      quoteEmail: 'devis@fournisseur.test',
      organizationEmail: null,
      members: [],
    }

    assert.deepEqual(resolveQuoteAddresses(candidates), [
      { email: 'devis@fournisseur.test', locale: 'fr' },
    ])
  })

  test('un membre présent deux fois n’est prévenu qu’une fois', ({ assert }) => {
    const twice = [MEMBERS[0], MEMBERS[0]]

    assert.lengthOf(
      resolveQuoteAddresses({ quoteEmail: null, organizationEmail: null, members: twice }),
      1
    )
  })
})
