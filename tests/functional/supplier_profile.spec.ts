import { test } from '@japa/runner'
import { ModerationDecisionFactory } from '#database/factories/moderation_decision_factory'
import Organization from '#models/organization'
import SupplierProfile from '#models/supplier_profile'
import SupplierProfileTransformer from '#transformers/supplier_profile_transformer'
import { useDatabase } from '#tests/utils/setup'
import { seededDevUser } from '#tests/utils/organizations'

test.group('Profil fournisseur — CRUD', (group) => {
  // Isolation par test : le PATCH mute le profil, on re-sème avant chacun.
  useDatabase(group, { seed: 'full' })

  test("l'écran affiche le profil de l'organisation fournisseur courante", async ({ client }) => {
    const user = await seededDevUser('eurogoods-org')

    const response = await client.get('/fr/supplier/profile').withInertia().loginAs(user)

    response.assertStatus(200)
    response.assertInertiaComponent('supplier/profile')
    response.assertInertiaPropsContains({
      profile: { deliveryScope: 'europe', minOrderQuantity: 50 },
    })
  })

  test('le statut de modération de l’organisation est visible du fournisseur', async ({
    client,
    assert,
  }) => {
    const user = await seededDevUser('eurogoods-org')
    const org = await Organization.findByOrFail('slug', 'eurogoods-org')

    const before = await client.get('/fr/supplier/profile').withInertia().loginAs(user)
    assert.deepEqual(before.inertiaProps.moderation, { status: 'pending', reason: null })

    await ModerationDecisionFactory.apply('organization')
      .apply('rejected')
      .merge({ targetId: org.id, reason: 'Dossier incomplet' })
      .create()
    const after = await client.get('/fr/supplier/profile').withInertia().loginAs(user)
    assert.deepEqual(after.inertiaProps.moderation, {
      status: 'rejected',
      reason: 'Dossier incomplet',
    })
  })

  test('un membre acheteur ne peut pas accéder au profil fournisseur (403)', async ({ client }) => {
    const user = await seededDevUser('promotionnal-sourcing')

    const response = await client.get('/fr/supplier/profile').withInertia().loginAs(user)

    response.assertStatus(403)
  })

  test('la mise à jour enregistre le profil (upsert)', async ({ client, assert }) => {
    const user = await seededDevUser('eurogoods-org')
    const org = await Organization.findByOrFail('slug', 'eurogoods-org')

    const response = await client
      .patch('/fr/supplier/profile')
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json({
        minOrderQuantity: 120,
        deliveryDays: 7,
        deliveryScope: 'worldwide',
        certifications: ['ISO 14001'],
        bio: 'Nouveau texte',
        responseTimeDays: 1,
      })

    response.assertStatus(200)

    const profile = await SupplierProfile.findByOrFail('organizationId', org.id)
    assert.equal(profile.minOrderQuantity, 120)
    assert.equal(profile.deliveryScope, 'worldwide')
    assert.deepEqual(profile.certifications, ['ISO 14001'])
    assert.equal(profile.responseTimeDays, 1)
  })

  test('le transformer expose la forme SupplierProfileType', async ({ assert }) => {
    const org = await Organization.findByOrFail('slug', 'eurogoods-org')
    const profile = await SupplierProfile.findByOrFail('organizationId', org.id)

    const dto = new SupplierProfileTransformer(profile).toObject()

    assert.equal(dto.organizationId, org.id)
    assert.isString(dto.createdAt)
    assert.equal(dto.deliveryScope, 'europe')
  })
})
