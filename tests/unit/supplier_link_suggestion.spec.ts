import { test } from '@japa/runner'
import { suggestOrganization } from '#shared/helpers/supplier_link'
import type { SupplierLinkCandidate } from '#shared/types/supplier_link'

function candidate(overrides: Partial<SupplierLinkCandidate> = {}): SupplierLinkCandidate {
  return { id: 1, name: 'Makito', email: null, website: null, memberEmails: [], ...overrides }
}

test.group('Rattachement fournisseur — suggestion d’organisation (#231)', () => {
  test('même email que l’organisation ou qu’un membre : correspondance « email »', ({ assert }) => {
    const byOrg = suggestOrganization({ email: 'Sales@Makito.es', website: null }, [
      candidate({ email: 'sales@makito.es' }),
    ])
    const byMember = suggestOrganization({ email: 'ana@gmail.com', website: null }, [
      candidate({ id: 2, memberEmails: ['ana@gmail.com'] }),
    ])

    assert.deepEqual(byOrg && { id: byOrg.candidate.id, match: byOrg.match }, {
      id: 1,
      match: 'email',
    })
    assert.equal(byMember?.candidate.id, 2)
    assert.equal(byMember?.match, 'email')
  })

  test('domaine commun (email, site, sous-domaine) : correspondance « domaine »', ({ assert }) => {
    const candidates = [
      candidate({ id: 1, website: 'https://www.other.com' }),
      candidate({ id: 2, memberEmails: ['paul@makito.es'] }),
    ]

    const byEmail = suggestOrganization({ email: 'info@fr.makito.es', website: null }, candidates)
    const byWebsite = suggestOrganization({ email: null, website: 'other.com/fr' }, candidates)

    assert.equal(byEmail?.candidate.id, 2)
    assert.equal(byEmail?.match, 'domain')
    assert.equal(byWebsite?.candidate.id, 1)
  })

  test('l’email exact l’emporte sur un domaine commun trouvé plus tôt', ({ assert }) => {
    const found = suggestOrganization({ email: 'sales@makito.es', website: null }, [
      candidate({ id: 1, website: 'makito.es' }),
      candidate({ id: 2, email: 'sales@makito.es' }),
    ])

    assert.equal(found?.candidate.id, 2)
    assert.equal(found?.match, 'email')
  })

  test('un domaine grand public ne suffit pas, et sans coordonnées rien n’est proposé', ({
    assert,
  }) => {
    const candidates = [candidate({ memberEmails: ['someone@gmail.com'] })]

    assert.isNull(suggestOrganization({ email: 'other@gmail.com', website: null }, candidates))
    assert.isNull(suggestOrganization({ email: null, website: null }, candidates))
  })
})
