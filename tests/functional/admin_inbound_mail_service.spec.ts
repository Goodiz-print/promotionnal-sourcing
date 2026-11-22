import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import emitter from '@adonisjs/core/services/emitter'
import InboundMailReceived from '#events/inbound_mail_received'
import AdminAuditLog from '#models/admin_audit_log'
import InboundMail from '#models/inbound_mail'
import AdminInboundMailService from '#services/admin_inbound_mail_service'
import { InboundMailFactory } from '#database/factories/inbound_mail_factory'
import { sentRfq, TEST_RELAY_DOMAIN, useFakeInboundMail } from '#tests/utils/inbound_mail'
import { useDatabase } from '#tests/utils/setup'

const CONTEXT = { actor: null, ip: null }

/** Demande envoyée et les deux adresses relais du couple. */
async function scenario() {
  const sent = await sentRfq()
  return {
    ...sent,
    agencyAddress: `agency-${sent.recipient.agencyReplyToken}@${TEST_RELAY_DOMAIN}`,
  }
}

/** `InboundMailReceived` a-t-il été annoncé pour ce mail, de ce côté ? */
function announced(events: ReturnType<typeof emitter.fake>, mailId: number, side: string) {
  events.assertEmitted(InboundMailReceived, ({ data }) => {
    const { mail } = data as InboundMailReceived
    return mail.inboundMailId === mailId && mail.side === side
  })
}

test.group('AdminInboundMailService — côté du mail rejoué ou rattaché (#226)', (group) => {
  useDatabase(group)
  const inbound = useFakeInboundMail(group)
  group.each.setup(() => () => emitter.restore())

  test('replay d’un mail traité : réannoncé du côté de son adresse relais', async ({ assert }) => {
    const { recipient, address, agencyAddress } = await scenario()
    const fromAgency = await InboundMailFactory.merge({
      recipient: agencyAddress,
      rfqSupplierId: recipient.id,
      status: 'processed',
    }).create()
    const fromSupplier = await InboundMailFactory.merge({
      recipient: address,
      rfqSupplierId: recipient.id,
      status: 'processed',
    }).create()
    const events = emitter.fake([InboundMailReceived])
    const admin = await app.container.make(AdminInboundMailService)

    assert.equal(await admin.replay(fromAgency.id, CONTEXT), 'republished')
    assert.equal(await admin.replay(fromSupplier.id, CONTEXT), 'republished')

    announced(events, fromAgency.id, 'agency')
    announced(events, fromSupplier.id, 'supplier')
    assert.lengthOf(await AdminAuditLog.query().where('action', 'inbound_mail.replayed'), 2)
  })

  test('replay d’un mail traité sans couple : refusé, rien n’est annoncé', async ({ assert }) => {
    const mail = await InboundMailFactory.merge({
      recipient: `rfq-${'0'.repeat(32)}@${TEST_RELAY_DOMAIN}`,
      status: 'processed',
    }).create()
    const events = emitter.fake([InboundMailReceived])
    const admin = await app.container.make(AdminInboundMailService)

    assert.equal(await admin.replay(mail.id, CONTEXT), 'refused')
    events.assertNotEmitted(InboundMailReceived)
  })

  test('attach d’un mail `agency-` écarté (expéditeur inconnu) : traité côté agence', async ({
    assert,
  }) => {
    const { recipient, agencyAddress } = await scenario()
    const rejected = await InboundMailFactory.merge({
      recipient: agencyAddress,
      senderAddress: 'assistante@gmail.test',
      status: 'rejected',
      rejectionReason: 'unknown_sender',
    }).create()
    inbound.provider.add(rejected.providerMessageId, {
      to: agencyAddress,
      from: 'assistante@gmail.test',
      text: 'Bonjour',
    })
    const events = emitter.fake([InboundMailReceived])
    const admin = await app.container.make(AdminInboundMailService)

    const outcome = await admin.attach(rejected.id, recipient.id, CONTEXT)

    assert.equal(outcome, 'processed')
    const processed = await InboundMail.findOrFail(rejected.id)
    assert.equal(processed.rfqSupplierId, recipient.id)
    assert.isNull(processed.rejectionReason)
    announced(events, rejected.id, 'agency')
  })
})
