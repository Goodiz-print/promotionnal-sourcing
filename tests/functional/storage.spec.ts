import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { StorageObjectFactory } from '#database/factories/storage_object_factory'
import Organization from '#models/organization'
import StorageObject from '#models/storage_object'
import StorageService from '#services/storage/storage_service'
import StorageCleanupService from '#services/storage/storage_cleanup_service'
import DeleteStorageObjectJob from '#jobs/delete_storage_object_job'
import RecoverStorageUploadsJob from '#jobs/recover_storage_uploads_job'
import {
  StorageUploadException,
  StorageUploadInProgressException,
} from '#exceptions/storage_errors'
import type { Assert } from '@japa/assert'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import { sha256, uploadedFile, useFakeStorage } from '#tests/utils/storage'
import { useDatabase } from '#tests/utils/setup'

const service = () => app.container.make(StorageService)
const cleanup = () => app.container.make(StorageCleanupService)

async function storeFile(file: MultipartFile) {
  const storage = await service()
  return storage.store(file)
}

async function storeFiles(files: MultipartFile[]) {
  const storage = await service()
  return storage.storeMany(files)
}

async function purge(tombstoneId: number) {
  const cleaner = await cleanup()
  return cleaner.purgeDeleted(tombstoneId)
}

async function assertReady(assert: Assert, id: number) {
  const row = await StorageObject.findOrFail(id)
  assert.equal(row.status, 'ready')
}

async function recover() {
  const cleaner = await cleanup()
  return cleaner.recoverStale()
}

/**
 * Remplacement d'une référence **à la main** (la mécanique que les services
 * métier orchestrent) : met à jour le logo et appelle `release` dans la même
 * transaction. `failAfter` simule un échec tardif de la transaction métier.
 */
async function swapLogo(
  organization: Organization,
  next: StorageObject | null,
  { failAfter = false }: { failAfter?: boolean } = {}
) {
  const storage = await service()
  const previousId = organization.logoStorageObjectId
  return db.transaction(async (trx) => {
    await Organization.query({ client: trx })
      .where('id', organization.id)
      .update({ logo_storage_object_id: next?.id ?? null })
    const tombstoneId = await storage.release(trx, previousId)
    if (failAfter) throw new Error('échec de la transaction métier')
    return tombstoneId
  })
}

test.group('Stockage Cellar — envoi idempotent', (group) => {
  useDatabase(group, { seed: 'none' })
  const fake = useFakeStorage(group)

  test('la clé est déterministe : promotionnal-sourcing/<NODE_ENV>/<sha256>.<ext>', async ({
    assert,
  }) => {
    const object = await storeFile(await uploadedFile('contenu', 'png'))

    assert.equal(object.key, `promotionnal-sourcing/test/${sha256('contenu')}.png`)
    assert.equal(object.checksum, sha256('contenu'))
    assert.equal(object.status, 'ready')
    assert.equal(object.mimeType, 'image/png')
    assert.equal(object.size, Buffer.byteLength('contenu'))
  })

  test('uploader deux fois le même contenu : un seul objet, une seule ligne', async ({
    assert,
  }) => {
    const storage = await service()

    const first = await storage.store(await uploadedFile('identique'))
    const second = await storage.store(await uploadedFile('identique'))

    assert.equal(first.id, second.id)
    assert.lengthOf(await StorageObject.query(), 1)
    assert.lengthOf(fake.driver.puts, 1)
    assert.equal(fake.driver.objects.size, 1)
  })

  test('deux contenus différents donnent deux objets', async ({ assert }) => {
    const storage = await service()

    await storage.store(await uploadedFile('a'))
    await storage.store(await uploadedFile('b'))

    assert.lengthOf(await StorageObject.query().where('status', 'ready'), 2)
    assert.equal(fake.driver.objects.size, 2)
  })

  test('storeMany dédoublonne les fichiers identiques d’un même lot', async ({ assert }) => {
    const objects = await storeFiles([
      await uploadedFile('x'),
      await uploadedFile('x'),
      await uploadedFile('y'),
    ])

    assert.lengthOf(objects, 3)
    assert.lengthOf(await StorageObject.query(), 2)
    assert.lengthOf(fake.driver.puts, 2)
  })

  test('échec d’upload : ni ligne pending_upload ni objet', async ({ assert }) => {
    fake.driver.failure = 'before-write'

    await assert.rejects(
      async () => storeFile(await uploadedFile('perdu')),
      StorageUploadException.message
    )

    assert.lengthOf(await StorageObject.query(), 0)
    assert.equal(fake.driver.objects.size, 0)
  })

  test('échec après écriture : l’objet partiellement stocké est supprimé aussi', async ({
    assert,
  }) => {
    fake.driver.failure = 'after-write'

    await assert.rejects(async () => storeFile(await uploadedFile('perdu')))

    assert.lengthOf(await StorageObject.query(), 0)
    assert.equal(fake.driver.objects.size, 0)
    assert.lengthOf(fake.driver.deletes, 1)
  })

  test('storeMany : si un fichier échoue, ceux déjà stockés sont libérés', async ({ assert }) => {
    const storage = await service()
    const files = [await uploadedFile('un'), await uploadedFile('deux')]
    // Le second envoi échoue : on coupe le faux après le premier `put`.
    const put = fake.driver.put.bind(fake.driver)
    fake.driver.put = async (key, content, mime) => {
      if (fake.driver.puts.length === 1) fake.driver.failure = 'before-write'
      return put(key, content, mime)
    }

    await assert.rejects(() => storage.storeMany(files))

    assert.lengthOf(await StorageObject.query(), 0)
    assert.equal(fake.driver.objects.size, 0)
  })

  test('un envoi identique déjà en cours (ligne récente) est refusé', async ({ assert }) => {
    const checksum = sha256('concurrent')
    await StorageObjectFactory.apply('pendingUpload')
      .merge({ checksum, key: `promotionnal-sourcing/test/${checksum}.png` })
      .create()

    await assert.rejects(
      async () => storeFile(await uploadedFile('concurrent')),
      StorageUploadInProgressException.message
    )
    assert.lengthOf(fake.driver.puts, 0)
  })

  test('une ligne pending_upload abandonnée est reprise par le nouvel envoi', async ({
    assert,
  }) => {
    const checksum = sha256('abandonne')
    const stale = await StorageObjectFactory.apply('pendingUpload')
      .merge({
        checksum,
        key: `promotionnal-sourcing/test/${checksum}.png`,
        createdAt: DateTime.now().minus({ minutes: 30 }),
      })
      .create()

    const object = await storeFile(await uploadedFile('abandonne'))

    assert.equal(object.id, stale.id)
    assert.equal(object.status, 'ready')
    assert.lengthOf(await StorageObject.query(), 1)
  })
})

test.group('Stockage Cellar — remplacement et purge', (group) => {
  useDatabase(group, { seed: 'none' })
  const fake = useFakeStorage(group)

  test('remplacement : pending_delete écrit dans la même transaction que la nouvelle référence', async ({
    assert,
  }) => {
    const storage = await service()
    const organization = await OrganizationFactory.create()
    const old = await storage.store(await uploadedFile('ancien'))
    await organization.merge({ logoStorageObjectId: old.id }).save()
    const next = await storage.store(await uploadedFile('nouveau'))

    const tombstoneId = await swapLogo(organization, next)

    await organization.refresh()
    assert.equal(organization.logoStorageObjectId, next.id)
    const tombstone = await StorageObject.findOrFail(tombstoneId!)
    assert.equal(tombstone.status, 'pending_delete')
    assert.equal(tombstone.key, old.key)
    // L'objet n'est pas touché tant que le job n'a pas tourné.
    assert.isTrue(fake.driver.objects.has(old.key))
    assert.lengthOf(await StorageObject.query().where('key', old.key), 1)
  })

  test('si la transaction métier échoue, aucune pending_delete n’est écrite', async ({
    assert,
  }) => {
    const storage = await service()
    const organization = await OrganizationFactory.create()
    const old = await storage.store(await uploadedFile('ancien'))
    await organization.merge({ logoStorageObjectId: old.id }).save()
    const next = await storage.store(await uploadedFile('nouveau'))

    await assert.rejects(() => swapLogo(organization, next, { failAfter: true }))

    await organization.refresh()
    assert.equal(organization.logoStorageObjectId, old.id)
    assert.lengthOf(await StorageObject.query().where('status', 'pending_delete'), 0)
    await assertReady(assert, old.id)
  })

  test('le job pending_delete supprime l’objet puis la ligne', async ({ assert }) => {
    const tombstone = await StorageObjectFactory.apply('pendingDelete').create()
    fake.driver.objects.set(tombstone.key, { content: Buffer.from('x'), mimeType: 'image/jpeg' })

    await DeleteStorageObjectJob.dispatch({ storageObjectId: tombstone.id })

    assert.isFalse(fake.driver.objects.has(tombstone.key))
    assert.lengthOf(await StorageObject.query(), 0)
  })

  test('supprimer un objet déjà absent est un succès', async ({ assert }) => {
    const tombstone = await StorageObjectFactory.apply('pendingDelete').create()

    await assert.doesNotReject(() => purge(tombstone.id))

    assert.lengthOf(await StorageObject.query(), 0)
  })

  test('pending_delete ne supprime jamais un objet encore référencé par une ligne ready', async ({
    assert,
  }) => {
    const ready = await StorageObjectFactory.create()
    fake.driver.objects.set(ready.key, { content: Buffer.from('x'), mimeType: 'image/jpeg' })
    const tombstone = await StorageObjectFactory.apply('pendingDelete')
      .merge({ key: ready.key, checksum: ready.checksum })
      .create()

    const deleted = await purge(tombstone.id)

    assert.isFalse(deleted)
    assert.isTrue(fake.driver.objects.has(ready.key))
    assert.lengthOf(fake.driver.deletes, 0)
    await assertReady(assert, ready.id)
    assert.isNull(await StorageObject.find(tombstone.id))
  })

  test('un objet encore utilisé par une autre référence n’est pas libéré', async ({ assert }) => {
    const storage = await service()
    const shared = await storage.store(await uploadedFile('partage'))
    const first = await OrganizationFactory.merge({ logoStorageObjectId: shared.id }).create()
    await OrganizationFactory.merge({ logoStorageObjectId: shared.id }).create()

    const tombstoneId = await swapLogo(first, null)

    assert.isNull(tombstoneId)
    await assertReady(assert, shared.id)
    assert.isTrue(fake.driver.objects.has(shared.key))
  })

  test('re-téléverser le contenu avant la purge sauve l’objet', async ({ assert }) => {
    const storage = await service()
    const organization = await OrganizationFactory.create()
    const old = await storage.store(await uploadedFile('revenant'))
    await organization.merge({ logoStorageObjectId: old.id }).save()
    const tombstoneId = await swapLogo(organization, null)

    // Même contenu renvoyé avant que le job ne tourne : nouvelle ligne ready.
    const again = await storage.store(await uploadedFile('revenant'))
    await purge(tombstoneId!)

    assert.notEqual(again.id, old.id)
    assert.isTrue(fake.driver.objects.has(old.key))
    await assertReady(assert, again.id)
    assert.lengthOf(await StorageObject.query().where('status', 'pending_delete'), 0)
  })
})

test.group('Stockage Cellar — reprise', (group) => {
  useDatabase(group, { seed: 'none' })
  const fake = useFakeStorage(group)

  test('supprime un pending_upload de plus de 24 h (objet + ligne), jamais un ready', async ({
    assert,
  }) => {
    const stale = await StorageObjectFactory.apply('pendingUpload').apply('stale').create()
    fake.driver.objects.set(stale.key, { content: Buffer.from('x'), mimeType: 'image/jpeg' })
    const fresh = await StorageObjectFactory.apply('pendingUpload').create()
    const oldReady = await StorageObjectFactory.apply('stale').create()
    fake.driver.objects.set(oldReady.key, { content: Buffer.from('y'), mimeType: 'image/jpeg' })

    const result = await recover()

    assert.equal(result.uploads, 1)
    assert.isFalse(fake.driver.objects.has(stale.key))
    assert.isNull(await StorageObject.find(stale.id))
    assert.isNotNull(await StorageObject.find(fresh.id))
    assert.isNotNull(await StorageObject.find(oldReady.id))
    assert.isTrue(fake.driver.objects.has(oldReady.key))
    assert.deepEqual(fake.driver.deletes, [stale.key])
  })

  test('un pending_upload ancien sans objet côté Cellar est simplement supprimé', async ({
    assert,
  }) => {
    const stale = await StorageObjectFactory.apply('pendingUpload').apply('stale').create()

    await recover()

    assert.isNull(await StorageObject.find(stale.id))
    assert.lengthOf(fake.driver.deletes, 0)
  })

  test('rejoue une pierre tombale de plus de 24 h dont le job s’est perdu', async ({ assert }) => {
    const tombstone = await StorageObjectFactory.apply('pendingDelete').apply('stale').create()
    fake.driver.objects.set(tombstone.key, { content: Buffer.from('x'), mimeType: 'image/jpeg' })

    const result = await recover()

    assert.equal(result.deletions, 1)
    assert.isFalse(fake.driver.objects.has(tombstone.key))
    assert.lengthOf(await StorageObject.query(), 0)
  })

  test('le job planifié exécute la reprise', async ({ assert }) => {
    const stale = await StorageObjectFactory.apply('pendingUpload').apply('stale').create()

    await RecoverStorageUploadsJob.dispatch({})

    assert.isNull(await StorageObject.find(stale.id))
  })
})
