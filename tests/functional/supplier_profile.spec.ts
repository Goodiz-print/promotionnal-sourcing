import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import MainSeeder from '#database/seeders/main_seeder'
import Organization from '#models/organization'
import User from '#models/user'
import SupplierProfile from '#models/supplier_profile'
import SupplierProfileTransformer from '#transformers/supplier_profile_transformer'

/**
 * Positionne l'org courante du dev user sur l'org donnée (par slug) et renvoie
 * l'utilisateur rechargé.
 */
async function devUserWithCurrentOrg(slug: string): Promise<User> {
  const org = await Organization.findByOrFail('slug', slug)
  const user = await User.findByOrFail('email', 'malolebrin@gmail.com')
  await user.merge({ currentOrganizationId: org.id }).save()
  return user
}

test.group('Profil fournisseur — CRUD', (group) => {
  // Isolation par test : le PATCH mute le profil, on re-sème avant chacun.
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => new MainSeeder(db.connection()).run())

  test("l'écran affiche le profil de l'organisation fournisseur courante", async ({ client }) => {
    const user = await devUserWithCurrentOrg('eurogoods-org')

    const response = await client.get('/fr/supplier/profile').withInertia().loginAs(user)

    response.assertStatus(200)
    response.assertInertiaComponent('supplier/profile')
    response.assertInertiaPropsContains({
      profile: { deliveryScope: 'europe', minOrderQuantity: 50 },
    })
  })

  test('un membre acheteur ne peut pas accéder au profil fournisseur (403)', async ({ client }) => {
    const user = await devUserWithCurrentOrg('promotionnal-sourcing')

    const response = await client.get('/fr/supplier/profile').withInertia().loginAs(user)

    response.assertStatus(403)
  })

  test('la mise à jour enregistre le profil (upsert)', async ({ client, assert }) => {
    const user = await devUserWithCurrentOrg('eurogoods-org')
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
