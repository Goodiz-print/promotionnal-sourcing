import { test } from '@japa/runner'
import sharp from 'sharp'
import aiConfig from '#config/ai'
import { OrganizationFactory } from '#database/factories/organization_factory'
import SearchEvent from '#models/search_event'
import { ImageDescriptionFailedError } from '#exceptions/image_search_errors'
import { createMember } from '#tests/utils/organizations'
import { installFakeEngine, type FakeEngineHandle } from '#tests/utils/fake_search_engine'
import { useFakeImageDescription } from '#tests/utils/fake_image_description_provider'
import { uploadedFile } from '#tests/utils/storage'
import { useDatabase } from '#tests/utils/setup'

async function png(): Promise<Buffer> {
  return sharp({
    create: { width: 64, height: 48, channels: 3, background: { r: 200, g: 30, b: 30 } },
  })
    .png()
    .toBuffer()
}

test.group('Recherche par image', (group) => {
  useDatabase(group, { seed: 'full' })
  const fake = useFakeImageDescription(group)

  let handle: FakeEngineHandle
  group.each.setup(() => {
    handle = installFakeEngine()
    return () => handle.restore()
  })

  async function buyer() {
    const org = await OrganizationFactory.create()
    return createMember(org, 'owner')
  }

  test('redirige vers le catalogue avec la description comme terme de recherche', async ({
    client,
    assert,
  }) => {
    const user = await buyer()
    const file = await uploadedFile(await png(), 'png')

    const response = await client
      .post('/fr/products/image-search')
      .redirects(0)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .file('image', file.tmpPath!, { contentType: 'image/png' })

    response.assertStatus(302)
    const location = new URL(String(response.header('location')), 'http://localhost')
    assert.equal(location.pathname, '/fr/products')
    assert.equal(location.searchParams.get('search'), 'gourde inox')
    assert.equal(location.searchParams.get('imageSearch'), '1')

    // L'image est normalisée en JPEG avant d'être transmise au modèle.
    assert.lengthOf(fake.provider.calls, 1)
    assert.equal(fake.provider.calls[0].mimeType, 'image/jpeg')
    assert.equal(fake.provider.calls[0].locale, 'fr')
    const metadata = await sharp(fake.provider.calls[0].image).metadata()
    assert.equal(metadata.format, 'jpeg')
  })

  test('un visiteur anonyme est renvoyé vers la connexion, sans appel IA', async ({
    client,
    assert,
  }) => {
    const file = await uploadedFile(await png(), 'png')

    const response = await client
      .post('/fr/products/image-search')
      .redirects(0)
      .withInertia()
      .withCsrfToken()
      .file('image', file.tmpPath!, { contentType: 'image/png' })

    response.assertStatus(302)
    assert.include(response.header('location'), 'login')
    assert.lengthOf(fake.provider.calls, 0)
  })

  test('un fichier d’un type non accepté est refusé', async ({ client, assert }) => {
    const user = await buyer()
    const file = await uploadedFile('pas une image', 'gif')

    const response = await client
      .post('/fr/products/image-search')
      .redirects(0)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .file('image', file.tmpPath!, { contentType: 'image/gif' })

    response.assertStatus(302)
    assert.lengthOf(fake.provider.calls, 0)
  })

  test('un contenu illisible malgré l’extension .png est refusé', async ({ client, assert }) => {
    const user = await buyer()
    const file = await uploadedFile('<html>pas une image</html>', 'png')

    const response = await client
      .post('/fr/products/image-search')
      .redirects(0)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .file('image', file.tmpPath!, { contentType: 'image/png' })

    response.assertStatus(302)
    assert.notInclude(response.header('location'), 'imageSearch')
    assert.lengthOf(fake.provider.calls, 0)
  })

  test('un échec du modèle renvoie à la page sans lancer de recherche', async ({
    client,
    assert,
  }) => {
    fake.provider.response = new ImageDescriptionFailedError('boom')
    const user = await buyer()
    const file = await uploadedFile(await png(), 'png')

    const response = await client
      .post('/fr/products/image-search')
      .redirects(0)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .file('image', file.tmpPath!, { contentType: 'image/png' })

    response.assertStatus(302)
    assert.notInclude(response.header('location'), 'imageSearch')
  })

  test('fonction désactivée : aucun appel au modèle', async ({ client, assert }) => {
    aiConfig.vision.enabled = false
    const user = await buyer()
    const file = await uploadedFile(await png(), 'png')

    const response = await client
      .post('/fr/products/image-search')
      .redirects(0)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .file('image', file.tmpPath!, { contentType: 'image/png' })

    response.assertStatus(302)
    assert.notInclude(response.header('location'), 'imageSearch')
    assert.lengthOf(fake.provider.calls, 0)
  })

  test('le catalogue signale la disponibilité du bouton aux acheteurs connectés seulement', async ({
    client,
  }) => {
    const user = await buyer()

    const connected = await client.get('/fr/products').withInertia().loginAs(user)
    connected.assertInertiaPropsContains({ imageSearchEnabled: true })

    const anonymous = await client.get('/fr/products').withInertia()
    anonymous.assertInertiaPropsContains({ imageSearchEnabled: false })
  })

  test('une recherche issue d’une photo est journalisée avec la source catalogue_image', async ({
    client,
    assert,
  }) => {
    const user = await buyer()

    const response = await client
      .get('/fr/products')
      .qs({ search: 'gourde inox', imageSearch: 1 })
      .withInertia()
      .loginAs(user)

    response.assertInertiaPropsContains({ imageSearch: true })
    const event = await SearchEvent.firstOrFail()
    assert.equal(event.source, 'catalogue_image')
    assert.equal(event.query, 'gourde inox')
  })

  test('le paramètre imageSearch est ignoré sans terme de recherche', async ({ client }) => {
    const response = await client.get('/fr/products').qs({ imageSearch: 1 }).withInertia()
    response.assertInertiaPropsContains({ imageSearch: false })
  })
})
