import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { ConversationFactory } from '#database/factories/conversation_factory'
import { MessageFactory } from '#database/factories/message_factory'
import { RfqSupplierFactory } from '#database/factories/rfq_supplier_factory'
import RfqThreadTransformer from '#transformers/rfq_thread_transformer'
import type Conversation from '#models/conversation'
import type Message from '#models/message'
import type RfqSupplier from '#models/rfq_supplier'
import type { RfqThreadView } from '#shared/types/conversation'

async function recipient(): Promise<RfqSupplier> {
  return RfqSupplierFactory.merge({
    id: 4,
    rfqId: 7,
    replyToken: 'a'.repeat(32),
    agencyReplyToken: 'b'.repeat(32),
  }).make()
}

async function loadedThread(blockedAt: DateTime | null) {
  const conversation = await ConversationFactory.merge({ id: 2, blockedAt }).make()
  const message = await MessageFactory.merge({
    id: 9,
    body: 'Bonjour',
    senderSide: 'supplier',
    createdAt: DateTime.fromISO('2026-11-22T10:00:00.000Z', { zone: 'utc' }),
  }).make()
  message.$setRelated('attachments', [])
  return { conversation, messages: [message], hasOlder: true }
}

function view(
  overrides: Partial<RfqThreadView<Conversation, Message>> = {}
): RfqThreadView<Conversation, Message> {
  return {
    thread: null,
    viewerSide: 'agency',
    counterpartName: 'Fournisseur Dupuis',
    canWrite: true,
    closed: false,
    ...overrides,
  }
}

test.group('RfqThreadTransformer (#226)', () => {
  test('un destinataire sans fil donne un fil vide où l’on peut écrire', async ({ assert }) => {
    const thread = new RfqThreadTransformer(await recipient(), view()).toObject()

    assert.deepEqual(thread, {
      rfqSupplierId: 4,
      counterpartName: 'Fournisseur Dupuis',
      blocked: false,
      closed: false,
      canWrite: true,
      hasOlder: false,
      messages: [],
    })
  })

  test('les messages chargés passent par le transformer de message, du côté qui lit', async ({
    assert,
  }) => {
    const thread = new RfqThreadTransformer(
      await recipient(),
      view({ thread: await loadedThread(null) })
    ).toObject()

    assert.isTrue(thread.hasOlder)
    assert.lengthOf(thread.messages, 1)
    assert.include(thread.messages[0], { id: 9, side: 'supplier', mine: false })
  })

  test('un fil bloqué ou clos ne s’écrit plus, quel que soit le droit', async ({ assert }) => {
    const blocked = new RfqThreadTransformer(
      await recipient(),
      view({ thread: await loadedThread(DateTime.now()) })
    ).toObject()
    const closed = new RfqThreadTransformer(await recipient(), view({ closed: true })).toObject()
    const denied = new RfqThreadTransformer(await recipient(), view({ canWrite: false })).toObject()

    assert.include(blocked, { blocked: true, canWrite: false })
    assert.include(closed, { closed: true, canWrite: false })
    assert.isFalse(denied.canWrite)
  })

  test('ni jeton relais, ni identifiants de la demande ou des organisations', async ({
    assert,
  }) => {
    const thread = new RfqThreadTransformer(await recipient(), view()).toObject()
    const json = JSON.stringify(thread)

    assert.notInclude(json, 'a'.repeat(32))
    assert.notInclude(json, 'b'.repeat(32))
    assert.notProperty(thread, 'rfqId')
    assert.notProperty(thread, 'supplierOrganizationId')
  })
})
