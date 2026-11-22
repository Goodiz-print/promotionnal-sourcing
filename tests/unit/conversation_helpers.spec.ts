import { test } from '@japa/runner'
import { agencyMessageMail } from '#shared/helpers/agency_message'
import { conversationSidesOf, latestMessages, postedMessageFor } from '#shared/helpers/conversation'
import type { AgencyMessageMailInput } from '#shared/types/conversation'

const PARTIES = { buyerOrganizationId: 1, supplierOrganizationId: 2 }

test.group('Fil d’une demande — côtés (#226)', () => {
  test('conversationSidesOf : côtés de l’adhésion, l’agence d’abord', ({ assert }) => {
    assert.deepEqual(conversationSidesOf([1], PARTIES), ['agency'])
    assert.deepEqual(conversationSidesOf([2], PARTIES), ['supplier'])
    assert.deepEqual(conversationSidesOf([2, 1], PARTIES), ['agency', 'supplier'])
    assert.deepEqual(conversationSidesOf([3], PARTIES), [])
  })

  test('postedMessageFor : un texte seul prend le premier côté de l’auteur', ({ assert }) => {
    assert.deepEqual(postedMessageFor('Bonjour', ['supplier']), {
      body: 'Bonjour',
      side: 'supplier',
    })
    assert.isNull(postedMessageFor('Bonjour', []))
  })

  test('postedMessageFor : un côté explicite doit être l’un de ceux de l’auteur', ({ assert }) => {
    const asSupplier = { body: 'Bonjour', side: 'supplier' as const }

    assert.deepEqual(postedMessageFor(asSupplier, ['agency', 'supplier']), asSupplier)
    assert.isNull(postedMessageFor(asSupplier, ['agency']))
  })

  test('latestMessages : derniers messages remis dans l’ordre, et s’il en reste', ({ assert }) => {
    assert.deepEqual(latestMessages([5, 4, 3], 3), { messages: [3, 4, 5], hasOlder: false })
    assert.deepEqual(latestMessages([5, 4, 3, 2], 3), { messages: [3, 4, 5], hasOlder: true })
    assert.deepEqual(latestMessages([], 3), { messages: [], hasOlder: false })
  })
})

const INPUT: AgencyMessageMailInput = {
  notice: {
    rfqId: 4,
    rfqTitle: 'Tote bags',
    agencyName: null,
    messageId: 12,
    body: 'Livraison avant le 15 ?',
    attachments: ['logo.png'],
    replyTo: 'rfq-abc@reply.test',
    headers: { Importance: 'high' },
  },
  address: { email: 'Devis@Fournisseur.test', locale: 'en' },
  rfqPath: '/en/supplier/rfqs/4',
}

test.group('Message de l’agence — charge du mail relayé (#226)', () => {
  test('destinataire, langue, texte, lien, Reply-To et en-têtes', ({ assert }) => {
    const payload = agencyMessageMail(INPUT)

    assert.equal(payload.kind, 'agency-message-relayed')
    assert.equal(payload.to, 'Devis@Fournisseur.test')
    assert.equal(payload.locale, 'en')
    assert.deepEqual(payload.data, {
      agencyName: null,
      rfqTitle: 'Tote bags',
      body: 'Livraison avant le 15 ?',
      attachments: ['logo.png'],
      rfqPath: '/en/supplier/rfqs/4',
      replyTo: 'rfq-abc@reply.test',
      headers: { Importance: 'high' },
    })
  })

  test('la clé d’idempotence porte le message et l’adresse', ({ assert }) => {
    const key = agencyMessageMail(INPUT).idempotencyKey
    const otherMessage = agencyMessageMail({ ...INPUT, notice: { ...INPUT.notice, messageId: 13 } })

    assert.equal(key, 'agency-message-relayed:message=12:to=devis@fournisseur.test')
    assert.notEqual(otherMessage.idempotencyKey, key)
  })
})
