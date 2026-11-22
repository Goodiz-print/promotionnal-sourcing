import { test } from '@japa/runner'
import { Bouncer } from '@adonisjs/bouncer'
import { DateTime } from 'luxon'
import * as abilities from '#abilities/main'
import inboundMailConfig from '#config/inbound_mail'
import Organization from '#models/organization'
import OrganizationUser from '#models/organization_user'
import User from '#models/user'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { sentRfq } from '#tests/utils/inbound_mail'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'

/** Demande envoyée, propriétaire de l'agence et du fournisseur. */
async function scenario() {
  const sent = await sentRfq()
  const buyer = await Organization.findOrFail(sent.rfq.buyerOrganizationId)
  const agencyMember = await createMember(buyer, 'member')
  const supplierOwner = await createMember(sent.supplier, 'owner')
  return { ...sent, buyer, agencyMember, supplierOwner }
}

function bouncerFor(user: User) {
  return new Bouncer(user, abilities)
}

/** Clôt la demande depuis `days` jours. */
function closedSince(days: number) {
  return { status: 'closed' as const, closedAt: DateTime.now().minus({ days }) }
}

test.group('Abilities — fil d’une demande (#226)', (group) => {
  useDatabase(group)

  test('canMessageRfqSupplier : tout membre de l’agence, fil ouvert', async ({ assert }) => {
    const { rfq, recipient, agencyMember } = await scenario()

    assert.isTrue(await bouncerFor(agencyMember).allows('canMessageRfqSupplier', rfq, recipient))
  })

  test('canMessageRfqSupplier : refusé hors agence, destinataire en attente ou d’une autre demande', async ({
    assert,
  }) => {
    const { rfq, recipient, agencyMember, supplierOwner } = await scenario()
    const other = await sentRfq()

    assert.isFalse(await bouncerFor(supplierOwner).allows('canMessageRfqSupplier', rfq, recipient))
    assert.isFalse(
      await bouncerFor(agencyMember).allows('canMessageRfqSupplier', rfq, other.recipient)
    )
    await recipient.merge({ status: 'pending' }).save()
    assert.isFalse(await bouncerFor(agencyMember).allows('canMessageRfqSupplier', rfq, recipient))
  })

  test('canMessageRfqBuyer : rôles qui répondent du fournisseur, pas un simple membre', async ({
    assert,
  }) => {
    const { rfq, recipient, supplier, supplierOwner, agencyMember } = await scenario()
    const member = await createMember(supplier, 'member')

    assert.isTrue(await bouncerFor(supplierOwner).allows('canMessageRfqBuyer', rfq, recipient))
    assert.isFalse(await bouncerFor(member).allows('canMessageRfqBuyer', rfq, recipient))
    assert.isFalse(await bouncerFor(agencyMember).allows('canMessageRfqBuyer', rfq, recipient))
  })

  test('les deux sont refusés une fois le délai de grâce passé, accordés pendant', async ({
    assert,
  }) => {
    const { rfq, recipient, agencyMember, supplierOwner } = await scenario()

    await rfq.merge(closedSince(inboundMailConfig.graceDays - 1)).save()
    assert.isTrue(await bouncerFor(agencyMember).allows('canMessageRfqSupplier', rfq, recipient))
    assert.isTrue(await bouncerFor(supplierOwner).allows('canMessageRfqBuyer', rfq, recipient))

    await rfq.merge(closedSince(inboundMailConfig.graceDays + 1)).save()
    assert.isFalse(await bouncerFor(agencyMember).allows('canMessageRfqSupplier', rfq, recipient))
    assert.isFalse(await bouncerFor(supplierOwner).allows('canMessageRfqBuyer', rfq, recipient))
  })

  test('l’adhésion est lue une fois par utilisateur chargé, relue pour une nouvelle requête', async ({
    assert,
  }) => {
    const { rfq, recipient, buyer, agencyMember } = await scenario()
    const sameRequest = bouncerFor(agencyMember)
    assert.isTrue(await sameRequest.allows('canMessageRfqSupplier', rfq, recipient))

    await OrganizationUser.query()
      .where('userId', agencyMember.id)
      .where('organizationId', buyer.id)
      .delete()

    // Même instance (même requête) : l'adhésion lue plus tôt fait foi.
    assert.isTrue(await sameRequest.allows('canMessageRfqSupplier', rfq, recipient))
    // Nouvelle requête : l'utilisateur est rechargé, l'adhésion relue.
    const reloaded = await User.findOrFail(agencyMember.id)
    assert.isFalse(await bouncerFor(reloaded).allows('canMessageRfqSupplier', rfq, recipient))
  })

  test('une organisation étrangère n’obtient rien, même avec un rôle élevé', async ({ assert }) => {
    const { rfq, recipient } = await scenario()
    const stranger = await createMember(await OrganizationFactory.create(), 'owner')

    assert.isFalse(await bouncerFor(stranger).allows('canMessageRfqSupplier', rfq, recipient))
    assert.isFalse(await bouncerFor(stranger).allows('canMessageRfqBuyer', rfq, recipient))
  })
})
