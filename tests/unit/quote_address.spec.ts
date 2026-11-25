import { test } from '@japa/runner'
import {
  hasQuoteEmailChanged,
  quoteAddressSource,
  resolveQuoteAddresses,
} from '#shared/helpers/quote_address'
import type { QuoteAddressCandidates, RfqMailAddress } from '#shared/types/rfq'

const MEMBERS: RfqMailAddress[] = [
  { email: 'ancien@fournisseur.test', locale: 'de' },
  { email: 'recent@fournisseur.test', locale: 'en' },
]

const ALL: QuoteAddressCandidates = {
  quoteEmail: 'devis@fournisseur.test',
  quoteEmailVerified: true,
  organizationEmail: 'contact@fournisseur.test',
  members: MEMBERS,
}

/** Règle de résolution de l'adresse de réception des demandes (#217). */
test.group('quoteAddressSource / resolveQuoteAddresses', () => {
  test('niveau 1 : l’adresse de réception confirmée prime', ({ assert }) => {
    assert.equal(quoteAddressSource(ALL), 'quote_email')
    assert.deepEqual(resolveQuoteAddresses(ALL), [
      { email: 'devis@fournisseur.test', locale: 'de' },
    ])
  })

  test('une adresse de réception non confirmée n’est pas utilisée', ({ assert }) => {
    const candidates = { ...ALL, quoteEmailVerified: false }

    assert.equal(quoteAddressSource(candidates), 'organization_email')
    assert.deepEqual(resolveQuoteAddresses(candidates), [
      { email: 'contact@fournisseur.test', locale: 'de' },
    ])
  })

  test('niveau 2 : à défaut, l’adresse de contact de l’organisation', ({ assert }) => {
    const candidates = { ...ALL, quoteEmail: null, quoteEmailVerified: false }

    assert.equal(quoteAddressSource(candidates), 'organization_email')
    assert.deepEqual(resolveQuoteAddresses(candidates), [
      { email: 'contact@fournisseur.test', locale: 'de' },
    ])
  })

  test('niveau 3 : sinon, chaque membre responsable dans sa langue', ({ assert }) => {
    const candidates = { ...ALL, quoteEmail: null, organizationEmail: null }

    assert.equal(quoteAddressSource(candidates), 'members')
    assert.deepEqual(resolveQuoteAddresses(candidates), MEMBERS)
  })

  test('une adresse vide ou faite d’espaces compte comme absente', ({ assert }) => {
    const candidates = { ...ALL, quoteEmail: '  ', organizationEmail: '' }

    assert.equal(quoteAddressSource(candidates), 'members')
  })

  test('une adresse explicite sans membre prend la langue par défaut', ({ assert }) => {
    const candidates = { ...ALL, members: [] }

    assert.deepEqual(resolveQuoteAddresses(candidates), [
      { email: 'devis@fournisseur.test', locale: 'fr' },
    ])
  })

  test('un membre présent deux fois n’est prévenu qu’une fois', ({ assert }) => {
    const candidates = {
      ...ALL,
      quoteEmail: null,
      organizationEmail: null,
      members: [MEMBERS[0], MEMBERS[0]],
    }

    assert.lengthOf(resolveQuoteAddresses(candidates), 1)
  })
})

test.group('hasQuoteEmailChanged', () => {
  test('une nouvelle adresse, un retrait ou un premier ajout sont des changements', ({
    assert,
  }) => {
    assert.isTrue(hasQuoteEmailChanged('a@f.test', 'b@f.test'))
    assert.isTrue(hasQuoteEmailChanged('a@f.test', null))
    assert.isTrue(hasQuoteEmailChanged(null, 'a@f.test'))
  })

  test('la casse, les espaces et un champ absent ne changent rien', ({ assert }) => {
    assert.isFalse(hasQuoteEmailChanged('Devis@F.test', ' devis@f.test '))
    assert.isFalse(hasQuoteEmailChanged('a@f.test', undefined))
    assert.isFalse(hasQuoteEmailChanged(null, ''))
  })
})
