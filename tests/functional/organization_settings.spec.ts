import { test } from '@japa/runner'
import { UserFactory } from '#database/factories/user_factory'
import Organization from '#models/organization'
import OrganizationTransformer from '#transformers/organization_transformer'
import OrganizationService from '#services/organization_service'
import StorageObject from '#models/storage_object'
import app from '@adonisjs/core/services/app'
import { uploadedFile, useFakeStorage } from '#tests/utils/storage'
import { useDatabase } from '#tests/utils/setup'
import { createMemberOf, seededDevUser } from '#tests/utils/organizations'

function service() {
  return app.container.make(OrganizationService)
}

test.group('Paramètres généraux de l’organisation', (group) => {
  useDatabase(group, { seed: 'full' })
  const storage = useFakeStorage(group)

  test("l'écran affiche les paramètres de l'organisation courante", async ({ client }) => {
    const user = await seededDevUser('eurogoods-org')

    const response = await client.get('/fr/organization/settings').withInertia().loginAs(user)

    response.assertStatus(200)
    response.assertInertiaComponent('organization/settings')
    response.assertInertiaPropsContains({ organization: { slug: 'eurogoods-org' } })
  })

  test('un membre non owner/admin ne peut pas accéder aux paramètres (403)', async ({ client }) => {
    const user = await createMemberOf('eurogoods-org')

    const response = await client.get('/fr/organization/settings').withInertia().loginAs(user)

    response.assertStatus(403)
  })

  test('un utilisateur sans organisation courante est renvoyé vers l’onboarding', async ({
    client,
  }) => {
    const user = await UserFactory.create()

    const response = await client.get('/fr/organization/settings').redirects(0).loginAs(user)

    response.assertStatus(302)
    response.assertHeader('location', '/fr/onboarding')
  })

  test('la mise à jour enregistre les champs texte', async ({ client, assert }) => {
    const user = await seededDevUser('eurogoods-org')
    const org = await Organization.findByOrFail('slug', 'eurogoods-org')

    const response = await client
      .post('/fr/organization/settings')
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json({
        name: 'EuroGoods Renamed',
        country: 'BE',
        siret: '12345678901234',
        city: 'Bruxelles',
        removeLogo: false,
      })

    response.assertStatus(200)

    await org.refresh()
    assert.equal(org.name, 'EuroGoods Renamed')
    assert.equal(org.country, 'BE')
    assert.equal(org.siret, '12345678901234')
    assert.equal(org.city, 'Bruxelles')
  })

  test('un champ de coordonnées vidé efface la valeur (#221)', async ({ client, assert }) => {
    const user = await seededDevUser('eurogoods-org')
    const org = await Organization.findByOrFail('slug', 'eurogoods-org')
    await org.merge({ email: 'contact@eurogoods.test', phone: '+33 1 00 00 00 00' }).save()

    // Formulaire multipart, comme l'écran : un champ vide devient `null`.
    const response = await client
      .post('/fr/organization/settings')
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .fields({ name: org.name, country: org.country, email: '', phone: '', removeLogo: '0' })

    response.assertStatus(200)
    await org.refresh()
    assert.isNull(org.email)
    assert.isNull(org.phone)
  })

  test('OrganizationService.updateLogo stocke puis remplace le logo (ancien objet purgé)', async ({
    assert,
  }) => {
    const org = await Organization.findByOrFail('slug', 'eurogoods-org')
    const svc = await service()

    await svc.updateLogo(org, await uploadedFile('logo-1'))
    await org.refresh()
    const first = await StorageObject.findOrFail(org.logoStorageObjectId!)
    assert.equal(org.logoUrl, `https://cellar.test/test-bucket/${first.key}`)

    await svc.updateLogo(org, await uploadedFile('logo-2'))
    await org.refresh()
    const second = await StorageObject.findOrFail(org.logoStorageObjectId!)

    assert.notEqual(first.key, second.key)
    assert.isFalse(storage.driver.objects.has(first.key))
    assert.isTrue(storage.driver.objects.has(second.key))
    assert.lengthOf(await StorageObject.query(), 1)
  })

  test('OrganizationService.removeLogo purge l’objet et remet logoUrl à null', async ({
    assert,
  }) => {
    const org = await Organization.findByOrFail('slug', 'eurogoods-org')
    const svc = await service()

    await svc.updateLogo(org, await uploadedFile('logo'))
    await org.refresh()
    const object = await StorageObject.findOrFail(org.logoStorageObjectId!)

    await svc.removeLogo(org)
    await org.refresh()

    assert.isNull(org.logoUrl)
    assert.isNull(org.logoStorageObjectId)
    assert.isFalse(storage.driver.objects.has(object.key))
    assert.lengthOf(await StorageObject.query(), 0)
  })

  test('le transformer expose la forme OrganizationType (dates en ISO)', async ({ assert }) => {
    const org = await Organization.findByOrFail('slug', 'eurogoods-org')

    const dto = new OrganizationTransformer(org).toObject()

    assert.equal(dto.slug, 'eurogoods-org')
    assert.isString(dto.createdAt)
  })
})
