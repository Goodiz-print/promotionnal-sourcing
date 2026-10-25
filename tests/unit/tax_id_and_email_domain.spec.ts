import { test } from '@japa/runner'
import { frenchVatFromSiren, isValidSiret, resolveTaxId } from '#shared/helpers/tax_id'
import { emailMatchesWebsite, isFreeEmailDomain, websiteHost } from '#shared/helpers/email_domain'
import { defaultLocaleForCountry } from '#shared/types/country'

test.group('Identifiant fiscal', () => {
  test('un SIRET valide (Luhn) devient un numéro de TVA français', ({ assert }) => {
    // SIRET de La Poste siège : 356 000 000 00048
    assert.isTrue(isValidSiret('35600000000048'))
    const resolved = resolveTaxId('356 000 000 00048')
    assert.equal(resolved?.kind, 'siret')
    assert.equal(resolved?.siret, '35600000000048')
    assert.equal(resolved?.countryCode, 'FR')
    assert.equal(resolved?.vatNumber, frenchVatFromSiren('356000000'))
  })

  test('la clé de TVA française se calcule depuis le SIREN', ({ assert }) => {
    // FR 40 303 265 045 : Google France
    assert.equal(frenchVatFromSiren('303265045'), '40303265045')
  })

  test('un SIRET dont la clé Luhn est fausse est refusé', ({ assert }) => {
    assert.isFalse(isValidSiret('35600000000049'))
    assert.isNull(resolveTaxId('35600000000049'))
  })

  test('un numéro de TVA est normalisé et découpé en pays + numéro', ({ assert }) => {
    const resolved = resolveTaxId('fr 40.303.265.045')
    assert.deepEqual(resolved, {
      kind: 'vat',
      countryCode: 'FR',
      vatNumber: '40303265045',
      siret: null,
    })
  })

  test('une saisie sans forme de TVA est refusée', ({ assert }) => {
    assert.isNull(resolveTaxId('12345'))
    assert.isNull(resolveTaxId('!!'))
  })
})

test.group('Domaine de l’email', () => {
  test('les messageries grand public sont reconnues', ({ assert }) => {
    assert.isTrue(isFreeEmailDomain('marie@Gmail.com'))
    assert.isFalse(isFreeEmailDomain('marie@agence.fr'))
  })

  test('l’hôte du site ignore schéma, www et chemin', ({ assert }) => {
    assert.equal(websiteHost('https://www.Agence.fr/contact'), 'agence.fr')
    assert.equal(websiteHost('agence.fr'), 'agence.fr')
    assert.isNull(websiteHost('pas un site'))
  })

  test('l’email correspond au site s’il est au même domaine ou en sous-domaine', ({ assert }) => {
    assert.isTrue(emailMatchesWebsite('marie@agence.fr', 'https://www.agence.fr'))
    assert.isTrue(emailMatchesWebsite('marie@mail.agence.fr', 'agence.fr'))
    assert.isFalse(emailMatchesWebsite('marie@autre.fr', 'https://agence.fr'))
    assert.isFalse(emailMatchesWebsite('marie@notagence.fr', 'agence.fr'))
  })
})

test.group('Langue par défaut selon le pays', () => {
  test('pays connu → sa langue, sinon anglais', ({ assert }) => {
    assert.equal(defaultLocaleForCountry('FR'), 'fr')
    assert.equal(defaultLocaleForCountry('SE'), 'sv')
    assert.equal(defaultLocaleForCountry('JP'), 'en')
  })
})
