import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { InboundMailFactory } from '#database/factories/inbound_mail_factory'
import { MessageFactory } from '#database/factories/message_factory'
import { UserFactory } from '#database/factories/user_factory'
import MessageAttachment from '#models/message_attachment'
import ConversationMessageTransformer from '#transformers/conversation_message_transformer'
import type Message from '#models/message'
import type { ConversationSide } from '#shared/types/conversation'

const CREATED_AT = DateTime.fromISO('2026-11-22T10:00:00.000Z', { zone: 'utc' })

/** Message écrit dans l'application par Marie Dupont, avec une pièce jointe. */
async function postedMessage(side: ConversationSide): Promise<Message> {
  const message = await MessageFactory.merge({
    id: 12,
    body: 'Livraison avant le 15 ?',
    senderSide: side,
    authorUserId: 3,
    inboundMailId: null,
    createdAt: CREATED_AT,
  }).make()
  const author = await UserFactory.merge({ id: 3, firstName: 'Marie', lastName: 'Dupont' }).make()
  const attachment = Object.assign(new MessageAttachment(), {
    id: 5,
    filename: 'logo.png',
    storageObjectId: 99,
  })
  message.$setRelated('author', author)
  message.$setRelated('attachments', [attachment])
  return message
}

/** Message né d'un mail envoyé par `sender`. */
async function mailedMessage(side: ConversationSide): Promise<Message> {
  const message = await MessageFactory.merge({
    id: 13,
    body: 'Oui',
    senderSide: side,
    authorUserId: null,
    inboundMailId: 8,
    createdAt: CREATED_AT,
  }).make()
  const mail = await InboundMailFactory.merge({
    id: 8,
    senderName: 'Marie Dupont',
    senderAddress: 'marie@agence-dupont.test',
    senderKnown: null,
    headers: { 'x-originating-ip': '203.0.113.7' },
  }).make()
  message.$setRelated('inboundMail', mail)
  message.$setRelated('attachments', [])
  return message
}

test.group('ConversationMessageTransformer (#226)', () => {
  test('forme exacte d’un message de son propre côté, auteur nommé', async ({ assert }) => {
    const message = await postedMessage('agency')

    assert.deepEqual(new ConversationMessageTransformer(message, 'agency').toObject(), {
      id: 12,
      body: 'Livraison avant le 15 ?',
      side: 'agency',
      mine: true,
      authorName: 'Marie Dupont',
      viaMail: false,
      mailSender: null,
      createdAt: '2026-11-22T10:00:00.000Z',
      attachments: [{ id: 5, filename: 'logo.png' }],
    })
  })

  test('l’auteur de l’autre côté n’est jamais nommé, ni ses identifiants exposés', async ({
    assert,
  }) => {
    const message = await postedMessage('agency')

    const seen = new ConversationMessageTransformer(message, 'supplier').toObject()

    assert.isFalse(seen.mine)
    assert.isNull(seen.authorName)
    assert.notProperty(seen, 'authorUserId')
    assert.notProperty(seen.attachments[0], 'storageObjectId')
  })

  test('un mail de l’agence n’est jamais décrit au fournisseur', async ({ assert }) => {
    const message = await mailedMessage('agency')

    const seen = new ConversationMessageTransformer(message, 'supplier').toObject()

    assert.isTrue(seen.viaMail)
    assert.isNull(seen.mailSender)
    assert.notInclude(JSON.stringify(seen), 'agence-dupont')
  })

  test('l’agence lit l’expéditeur de son mail ; connu par défaut faux, en-têtes absents', async ({
    assert,
  }) => {
    const message = await mailedMessage('agency')

    const seen = new ConversationMessageTransformer(message, 'agency').toObject()

    assert.deepEqual(seen.mailSender, {
      name: 'Marie Dupont',
      address: 'marie@agence-dupont.test',
      known: false,
    })
    assert.isNull(seen.authorName)
    assert.notInclude(JSON.stringify(seen), '203.0.113.7')
  })

  test('sans mail chargé, pas d’expéditeur', async ({ assert }) => {
    const message = await postedMessage('supplier')

    assert.isNull(new ConversationMessageTransformer(message, 'agency').toObject().mailSender)
  })
})
