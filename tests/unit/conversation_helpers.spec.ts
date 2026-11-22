import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { agencyMessageMail, agencyMessageVariant } from '#shared/helpers/agency_message'
import {
  conversationSidesOf,
  isRfqThreadOpen,
  latestMessages,
  mailSenderLabel,
  messageSenderLabel,
  postedMessageFor,
} from '#shared/helpers/conversation'
import type { AgencyMessageMailInput, RfqThreadState } from '#shared/types/conversation'

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

test.group('Fil d’une demande — ouverture à l’écriture (#226)', () => {
  const now = DateTime.fromISO('2026-11-22T12:00:00Z')
  const open: RfqThreadState = {
    rfq: { id: 7, status: 'published', closedAt: null, expiredAt: null },
    recipient: { rfqId: 7, status: 'sent' },
  }

  test('ouvert : demande publiée, destinataire notifié (même décliné)', ({ assert }) => {
    assert.isTrue(isRfqThreadOpen(open, 30, now))
    assert.isTrue(
      isRfqThreadOpen({ ...open, recipient: { rfqId: 7, status: 'declined' } }, 30, now)
    )
  })

  test('fermé : destinataire en attente ou d’une autre demande', ({ assert }) => {
    assert.isFalse(
      isRfqThreadOpen({ ...open, recipient: { rfqId: 7, status: 'pending' } }, 30, now)
    )
    assert.isFalse(isRfqThreadOpen({ ...open, recipient: { rfqId: 8, status: 'sent' } }, 30, now))
  })

  test('fermé passé le délai de grâce après la clôture, ouvert pendant', ({ assert }) => {
    const closedSince = (days: number): RfqThreadState => ({
      ...open,
      rfq: { id: 7, status: 'closed', closedAt: now.minus({ days }), expiredAt: null },
    })

    assert.isTrue(isRfqThreadOpen(closedSince(29), 30, now))
    assert.isFalse(isRfqThreadOpen(closedSince(31), 30, now))
  })
})

test.group('Fil d’une demande — libellés affichés (#226)', () => {
  test('mailSenderLabel : nom et adresse, ou l’adresse seule', ({ assert }) => {
    assert.equal(
      mailSenderLabel({ name: 'Paul', address: 'paul@f.test', known: true }),
      'Paul <paul@f.test>'
    )
    assert.equal(
      mailSenderLabel({ name: null, address: 'paul@f.test', known: false }),
      'paul@f.test'
    )
  })

  test('messageSenderLabel : l’autre côté, l’auteur, sinon « votre équipe »', ({ assert }) => {
    const labels = { counterpart: 'L’agence', yourTeam: 'Votre équipe' }

    assert.equal(messageSenderLabel({ mine: false, authorName: 'Marie' }, labels), 'L’agence')
    assert.equal(messageSenderLabel({ mine: true, authorName: 'Marie' }, labels), 'Marie')
    assert.equal(messageSenderLabel({ mine: true, authorName: null }, labels), 'Votre équipe')
  })

  test('agencyMessageVariant : nommée pour un abonné, anonyme sinon', ({ assert }) => {
    assert.equal(agencyMessageVariant('Agence Dupont'), 'named')
    assert.equal(agencyMessageVariant(null), 'anonymous')
  })
})
