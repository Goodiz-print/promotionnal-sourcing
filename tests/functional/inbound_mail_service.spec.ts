import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import emitter from '@adonisjs/core/services/emitter'
import { DateTime } from 'luxon'
import AgencyMailRefused from '#events/agency_mail_refused'
import InboundMailReceived from '#events/inbound_mail_received'
import InboundMail from '#models/inbound_mail'
import Organization from '#models/organization'
import InboundMailService from '#services/inbound_mail_service'
import { sentRfq, TEST_RELAY_DOMAIN, useFakeInboundMail } from '#tests/utils/inbound_mail'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'

/** Demande envoyée, membre de l'agence, et les deux adresses relais du couple. */
async function scenario() {
  const sent = await sentRfq()
  const buyer = await Organization.findOrFail(sent.rfq.buyerOrganizationId)
  await createMember(buyer, 'member', { email: 'marie@agence-dupont.test' })
  return {
    ...sent,
    agencyAddress: `agency-${sent.recipient.agencyReplyToken}@${TEST_RELAY_DOMAIN}`,
  }
}

/** Mail annoncé par le prestataire : adresse visée, expéditeur, en-têtes. */
interface ReceivedMail {
  to: string
  from: string
  headers?: Record<string, string>
}

test.group('InboundMailService — côté qui écrit (#226)', (group) => {
  useDatabase(group)
  const inbound = useFakeInboundMail(group)
  // L'événement est simulé : on observe ce que le service annonce, sans écouteur.
  group.each.setup(() => {
    emitter.fake([InboundMailReceived, AgencyMailRefused])
    return () => emitter.restore()
  })

  /** Le prestataire annonce le mail `id`, adressé à `to` par `from`. */
  async function receive(id: string, { to, from, headers }: ReceivedMail) {
    inbound.provider.add(id, { to, from, headers, text: 'Bonjour' })
    const service = await app.container.make(InboundMailService)
    const receipt = await service.receive(JSON.stringify({ id }), { 'x-test-signature': 'valid' })
    return { receipt, journal: await InboundMail.query().where('providerMessageId', id).first() }
  }

  test('journal : une adresse `agency-` se résout par le jeton de l’agence', async ({ assert }) => {
    const { recipient, agencyAddress } = await scenario()

    const { receipt, journal } = await receive('agency-1', {
      to: agencyAddress,
      from: 'marie@agence-dupont.test',
    })

    assert.equal(receipt, 'queued')
    assert.equal(journal?.rfqSupplierId, recipient.id)
  })

  test('journal : une adresse `agency-` portant le jeton du fournisseur ne résout rien', async ({
    assert,
  }) => {
    const { recipient } = await scenario()
    const forged = `agency-${recipient.replyToken}@${TEST_RELAY_DOMAIN}`

    const { journal } = await receive('forged', { to: forged, from: 'marie@agence-dupont.test' })

    assert.isNull(journal?.rfqSupplierId)
    assert.equal(journal?.status, 'rejected')
    assert.equal(journal?.rejectionReason, 'unknown_address')
  })

  test('process : le côté du mail est annoncé avec l’événement, expéditeur connu', async ({
    assert,
  }) => {
    const { recipient, address, agencyAddress } = await scenario()
    const events = emitter.fake([InboundMailReceived])

    const fromAgency = await receive('a', { to: agencyAddress, from: 'marie@agence-dupont.test' })
    const fromSupplier = await receive('s', { to: address, from: 'paul@ailleurs.test' })

    events.assertEmitted(InboundMailReceived, ({ data }) => {
      const { mail } = data as InboundMailReceived
      return mail.inboundMailId === fromAgency.journal!.id && mail.side === 'agency'
    })
    events.assertEmitted(InboundMailReceived, ({ data }) => {
      const { mail } = data as InboundMailReceived
      return mail.inboundMailId === fromSupplier.journal!.id && mail.side === 'supplier'
    })
    assert.isTrue(fromAgency.journal!.senderKnown)
    // Côté fournisseur, un inconnu reste indicatif : le mail est traité.
    assert.equal(fromSupplier.journal!.status, 'processed')
    assert.isFalse(fromSupplier.journal!.senderKnown)
    assert.equal(fromSupplier.journal!.rfqSupplierId, recipient.id)
  })

  test('process : un mail `agency-` d’un expéditeur hors de l’agence est écarté', async ({
    assert,
  }) => {
    const { agencyAddress } = await scenario()
    const events = emitter.fake([InboundMailReceived])

    const { journal } = await receive('x', { to: agencyAddress, from: 'inconnu@ailleurs.test' })

    assert.equal(journal?.status, 'rejected')
    assert.equal(journal?.rejectionReason, 'unknown_sender')
    assert.isNull(journal?.textBody)
    events.assertNotEmitted(InboundMailReceived)
  })

  test('process : un mail `agency-` écarté pour son expéditeur est annoncé à l’agence', async ({
    assert,
  }) => {
    const { recipient, agencyAddress, address } = await scenario()
    const events = emitter.fake([InboundMailReceived, AgencyMailRefused])

    const refused = await receive('r', { to: agencyAddress, from: 'inconnu@ailleurs.test' })
    await receive('o', {
      to: address,
      from: 'x@y.test',
      headers: { 'auto-submitted': 'auto-replied' },
    })

    events.assertEmittedCount(AgencyMailRefused, 1)
    events.assertEmitted(AgencyMailRefused, ({ data }) => {
      const { mail } = data as AgencyMailRefused
      return mail.inboundMailId === refused.journal!.id && mail.rfqSupplierId === recipient.id
    })
    assert.equal(refused.journal?.status, 'rejected')
  })

  test('process : un écouteur du refus défaillant ne fait pas repasser le mail en échec', async ({
    assert,
  }) => {
    const { agencyAddress } = await scenario()
    emitter.restore()
    emitter.fake([InboundMailReceived])
    const failing = () => {
      throw new Error('notification indisponible')
    }
    emitter.on(AgencyMailRefused, failing)

    try {
      const { journal } = await receive('e', { to: agencyAddress, from: 'inconnu@ailleurs.test' })

      assert.equal(journal?.status, 'rejected')
      assert.equal(journal?.rejectionReason, 'unknown_sender')
    } finally {
      // Seul cet écouteur part : celui de l'application reste branché.
      emitter.off(AgencyMailRefused, failing)
    }
  })

  test('process : un membre dont le domaine échoue DMARC est écarté (`From` falsifié)', async ({
    assert,
  }) => {
    const { agencyAddress, address } = await scenario()
    const failedDmarc = { 'authentication-results': 'mx.reply.test; spf=fail; dmarc=fail' }

    const forged = await receive('f', {
      to: agencyAddress,
      from: 'marie@agence-dupont.test',
      headers: failedDmarc,
    })
    const supplierSide = await receive('fs', {
      to: address,
      from: 'paul@ailleurs.test',
      headers: failedDmarc,
    })

    assert.equal(forged.journal?.rejectionReason, 'unknown_sender')
    // Côté fournisseur, l'authentification reste indicative : le mail est traité.
    assert.equal(supplierSide.journal?.status, 'processed')
  })

  test('process : un mail déjà écarté par un garde-fou ne vérifie pas son expéditeur', async ({
    assert,
  }) => {
    const { agencyAddress } = await scenario()

    const { journal } = await receive('auto', {
      to: agencyAddress,
      from: 'inconnu@ailleurs.test',
      headers: { 'auto-submitted': 'auto-replied' },
    })

    assert.equal(journal?.rejectionReason, 'auto_reply')
    assert.isNull(journal?.senderKnown)
  })

  test('process : rattaché à la main, il passe et garde le côté de son adresse', async ({
    assert,
  }) => {
    const { recipient, agencyAddress } = await scenario()
    const { journal } = await receive('m', { to: agencyAddress, from: 'inconnu@ailleurs.test' })
    await journal!
      .merge({
        status: 'received',
        rejectionReason: null,
        rfqSupplierId: recipient.id,
        attachedManuallyAt: DateTime.now(),
      })
      .save()
    const events = emitter.fake([InboundMailReceived])
    const service = await app.container.make(InboundMailService)

    await service.process(journal!.id)

    await journal!.refresh()
    assert.equal(journal!.status, 'processed')
    assert.isFalse(journal!.senderKnown)
    events.assertEmitted(InboundMailReceived, ({ data }) => {
      return (data as InboundMailReceived).mail.side === 'agency'
    })
  })
})
