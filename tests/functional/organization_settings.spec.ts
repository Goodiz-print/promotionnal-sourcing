import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { isPostgres } from '#tests/utils/database'
import MainSeeder from '#database/seeders/main_seeder'
import Organization from '#models/organization'
import OrganizationUser from '#models/organization_user'
import Role from '#models/role'
import User from '#models/user'
import OrganizationTransformer from '#transformers/organization_transformer'
import OrganizationService from '#services/organization_service'
import CloudinaryService, { type CloudinaryUploader } from '#services/cloudinary_service'
import hash from '@adonisjs/core/services/hash'
import type { MultipartFile } from '@adonisjs/core/bodyparser'

function fakeFile(name: string): MultipartFile {
  return { tmpPath: `/tmp/${name}` } as unknown as MultipartFile
}

/**
 * Faux uploader Cloudinary : aucun appel réseau, enregistre les suppressions.
 */
function fakeUploader() {
  const destroyed: string[] = []
  const uploader: CloudinaryUploader = {
    async upload(file, options) {
      const filename = file.split('/').pop()
      return {
        secure_url: `https://cdn.test/${options.folder}/${filename}`,
        public_id: `${options.folder}/${filename}`,
        width: 200,
        height: 200,
      } as Awaited<ReturnType<CloudinaryUploader['upload']>>
    },
    async destroy(publicId) {
      destroyed.push(publicId)
      return { result: 'ok' }
    },
  }
  return { uploader, destroyed }
}

function service(uploader: CloudinaryUploader) {
  return new OrganizationService(new CloudinaryService(uploader))
}

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

/**
 * Crée un membre au rôle `member` (non owner/admin) de l'organisation donnée.
 */
async function memberOf(slug: string): Promise<User> {
  const org = await Organization.findByOrFail('slug', slug)
  const memberRole = await Role.findByOrFail('slug', 'member')
  const user = await User.create({
    email: 'member@example.com',
    fullName: 'Simple Membre',
    password: await hash.make('password'),
    currentOrganizationId: org.id,
  })
  await OrganizationUser.create({ userId: user.id, organizationId: org.id, roleId: memberRole.id })
  return user
}

test.group('Paramètres généraux de l’organisation', (group) => {
  if (isPostgres()) {
    group.each.setup(() => testUtils.db().truncate())
    group.each.setup(() => new MainSeeder(db.connection()).run())
  } else {
    group.tap((t) => t.skip(true, 'Requiert PostgreSQL (seed catalogue pgvector/tsvector)'))
  }

  test("l'écran affiche les paramètres de l'organisation courante", async ({ client }) => {
    const user = await devUserWithCurrentOrg('eurogoods-org')

    const response = await client.get('/fr/organization/settings').withInertia().loginAs(user)

    response.assertStatus(200)
    response.assertInertiaComponent('organization/settings')
    response.assertInertiaPropsContains({ organization: { slug: 'eurogoods-org' } })
  })

  test('un membre non owner/admin ne peut pas accéder aux paramètres (403)', async ({ client }) => {
    const user = await memberOf('eurogoods-org')

    const response = await client.get('/fr/organization/settings').withInertia().loginAs(user)

    response.assertStatus(403)
  })

  test('un utilisateur sans organisation courante est renvoyé vers l’onboarding', async ({
    client,
  }) => {
    const user = await User.create({
      email: 'no-org@example.com',
      fullName: 'Sans Org',
      password: await hash.make('password'),
    })

    const response = await client.get('/fr/organization/settings').redirects(0).loginAs(user)

    response.assertStatus(302)
    response.assertHeader('location', '/fr/onboarding')
  })

  test('la mise à jour enregistre les champs texte', async ({ client, assert }) => {
    const user = await devUserWithCurrentOrg('eurogoods-org')
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

  test('OrganizationService.updateLogo uploade et remplace le logo (destroy ancien)', async ({
    assert,
  }) => {
    const org = await Organization.findByOrFail('slug', 'eurogoods-org')
    const { uploader, destroyed } = fakeUploader()
    const svc = service(uploader)

    await svc.updateLogo(org, fakeFile('logo1.png'))
    await org.refresh()
    assert.isTrue(org.logoUrl!.includes('logo1.png'))
    const firstPublicId = org.logoPublicId

    await svc.updateLogo(org, fakeFile('logo2.png'))
    await org.refresh()
    assert.isTrue(org.logoUrl!.includes('logo2.png'))
    assert.include(destroyed, firstPublicId!)
  })

  test('OrganizationService.removeLogo nettoie l’asset et remet logoUrl à null', async ({
    assert,
  }) => {
    const org = await Organization.findByOrFail('slug', 'eurogoods-org')
    const { uploader, destroyed } = fakeUploader()
    const svc = service(uploader)

    await svc.updateLogo(org, fakeFile('logo.png'))
    await org.refresh()
    const publicId = org.logoPublicId!

    await svc.removeLogo(org)
    await org.refresh()

    assert.isNull(org.logoUrl)
    assert.isNull(org.logoPublicId)
    assert.include(destroyed, publicId)
  })

  test('le transformer expose la forme OrganizationType (dates en ISO)', async ({ assert }) => {
    const org = await Organization.findByOrFail('slug', 'eurogoods-org')

    const dto = new OrganizationTransformer(org).toObject()

    assert.equal(dto.slug, 'eurogoods-org')
    assert.isString(dto.createdAt)
  })
})
