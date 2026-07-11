import { test } from '@japa/runner'
import CloudinaryService, { type CloudinaryUploader } from '#services/cloudinary_service'
import type { MultipartFile } from '@adonisjs/core/bodyparser'

function fakeFile(name: string): MultipartFile {
  return { tmpPath: `/tmp/${name}` } as unknown as MultipartFile
}

/**
 * Faux uploader Cloudinary : enregistre les appels, ne fait aucun appel réseau.
 */
function fakeUploader() {
  const calls = { folders: [] as string[], destroyed: [] as string[] }
  const uploader: CloudinaryUploader = {
    async upload(file, options) {
      calls.folders.push(options.folder)
      const filename = file.split('/').pop()
      return {
        secure_url: `https://res.cloudinary.com/${options.folder}/${filename}`,
        public_id: `${options.folder}/${filename}`,
        width: 800,
        height: 600,
      } as Awaited<ReturnType<CloudinaryUploader['upload']>>
    },
    async destroy(publicId) {
      calls.destroyed.push(publicId)
      return { result: 'ok' }
    },
  }
  return { uploader, calls }
}

test.group('CloudinaryService', () => {
  test('folderFor impose le préfixe promotionnal-sourcing/<env>', ({ assert }) => {
    const { uploader } = fakeUploader()
    const service = new CloudinaryService(uploader)

    assert.equal(
      service.folderFor('products/mon-produit'),
      'promotionnal-sourcing/test/products/mon-produit'
    )
  })

  test('uploadMany envoie chaque fichier dans le dossier imposé et mappe les assets', async ({
    assert,
  }) => {
    const { uploader, calls } = fakeUploader()
    const service = new CloudinaryService(uploader)

    const assets = await service.uploadMany([fakeFile('a.jpg'), fakeFile('b.jpg')], 'products/x')

    assert.lengthOf(assets, 2)
    assert.deepEqual(calls.folders, [
      'promotionnal-sourcing/test/products/x',
      'promotionnal-sourcing/test/products/x',
    ])
    assert.equal(assets[0].publicId, 'promotionnal-sourcing/test/products/x/a.jpg')
    assert.equal(
      assets[0].secureUrl,
      'https://res.cloudinary.com/promotionnal-sourcing/test/products/x/a.jpg'
    )
    assert.equal(assets[0].width, 800)
    assert.equal(assets[0].height, 600)
  })

  test('destroyMany supprime chaque asset par public_id', async ({ assert }) => {
    const { uploader, calls } = fakeUploader()
    const service = new CloudinaryService(uploader)

    await service.destroyMany(['id-1', 'id-2'])

    assert.deepEqual(calls.destroyed, ['id-1', 'id-2'])
  })

  test('upload sans fichier temporaire lève une erreur', async ({ assert }) => {
    const { uploader } = fakeUploader()
    const service = new CloudinaryService(uploader)

    await assert.rejects(() => service.upload({} as MultipartFile, 'products/x'))
  })
})
