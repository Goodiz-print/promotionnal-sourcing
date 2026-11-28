import { test } from '@japa/runner'
import { DEV_DEMO_PASSWORD, resolveDemoPassword } from '#shared/helpers/seed'
import {
  STAGING_SUPPLIER_ACCOUNTS,
  firstNameFromEmail,
  parseAdminEmails,
  stagingAgencyAccounts,
} from '#shared/helpers/staging_accounts'

test.group('Seed — mot de passe des comptes de démo', () => {
  test('hors production : la valeur configurée, sinon « password »', ({ assert }) => {
    assert.equal(resolveDemoPassword('  secret  ', false), 'secret')
    assert.equal(resolveDemoPassword(undefined, false), DEV_DEMO_PASSWORD)
    assert.equal(resolveDemoPassword('   ', false), DEV_DEMO_PASSWORD)
  })

  test('en production : seulement une valeur configurée de 12 caractères ou plus', ({ assert }) => {
    assert.equal(resolveDemoPassword('staging-Secret-42', true), 'staging-Secret-42')
    assert.isNull(resolveDemoPassword(undefined, true))
    assert.isNull(resolveDemoPassword('', true))
    assert.isNull(resolveDemoPassword('short-pass1', true))
  })
})

test.group('Seed — comptes de test du staging', () => {
  test('admins : liste normalisée, dédoublonnée, sans valeur invalide', ({ assert }) => {
    const emails = parseAdminEmails(
      ' Alice@Example.com, bob@example.com,,pas-un-email, alice@example.com '
    )

    assert.deepEqual(emails, ['alice@example.com', 'bob@example.com'])
    assert.deepEqual(parseAdminEmails(undefined), [])
    assert.deepEqual(parseAdminEmails(''), [])
  })

  test("prénom d'un admin déduit de son e-mail", ({ assert }) => {
    assert.equal(firstNameFromEmail('jean.dupont@example.com'), 'Jean')
    assert.equal(firstNameFromEmail('marie@example.com'), 'Marie')
  })

  test('un compte fournisseur fictif par catalogue importé', ({ assert }) => {
    assert.deepEqual(
      STAGING_SUPPLIER_ACCOUNTS.map((account) => account.supplierSlug),
      ['pf-concept', 'passot-innovation', 'inspirion', 'makito']
    )
    assert.deepInclude(STAGING_SUPPLIER_ACCOUNTS[3], {
      email: 'fournisseur-makito@promotionnal-sourcing.test',
      orgSlug: 'makito-org',
      orgName: 'Makito',
    })
  })

  test('agences fictives numérotées, chacune dans son organisation', ({ assert }) => {
    const agencies = stagingAgencyAccounts(2)

    assert.lengthOf(stagingAgencyAccounts(), 5)
    assert.deepEqual(agencies, [
      {
        email: 'agence-1@promotionnal-sourcing.test',
        firstName: 'Agence 1',
        orgSlug: 'agence-test-1',
        orgName: 'Agence test 1',
      },
      {
        email: 'agence-2@promotionnal-sourcing.test',
        firstName: 'Agence 2',
        orgSlug: 'agence-test-2',
        orgName: 'Agence test 2',
      },
    ])
  })
})
