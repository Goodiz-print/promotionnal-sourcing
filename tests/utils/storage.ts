import { createHash, randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import StorageDriver from '#services/storage/storage_driver'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import type { Group } from '@japa/runner/core'

type Failure = 'before-write' | 'after-write'

/**
 * Faux client Cellar : un `Map` en mémoire, aucun appel réseau. Enregistre les
 * appels pour que les specs vérifient « un seul envoi », « rien n'a été
 * supprimé », etc.
 */
export class FakeStorageDriver extends StorageDriver {
  readonly objects = new Map<string, { content: Buffer; mimeType: string }>()
  readonly puts: string[] = []
  readonly deletes: string[] = []

  /**
   * `before-write` : l'envoi échoue sans rien écrire ; `after-write` : l'objet
   * est écrit puis l'appel échoue (réponse perdue côté client).
   */
  failure: Failure | null = null

  async put(key: string, content: Buffer, mimeType: string): Promise<void> {
    this.puts.push(key)
    if (this.failure === 'before-write') throw new Error('Cellar indisponible')
    this.objects.set(key, { content, mimeType })
    if (this.failure === 'after-write') throw new Error('Réponse Cellar perdue')
  }

  async delete(key: string): Promise<void> {
    this.deletes.push(key)
    this.objects.delete(key)
  }

  async exists(key: string): Promise<boolean> {
    return this.objects.has(key)
  }

  async get(key: string): Promise<Buffer> {
    const object = this.objects.get(key)
    if (!object) throw new Error(`Objet introuvable : ${key}`)
    return object.content
  }

  url(key: string): string {
    return `https://cellar.test/test-bucket/${key}`
  }
}

/**
 * Remplace `StorageDriver` dans le conteneur le temps de chaque test du groupe,
 * et rend le faux courant. Tout ce qui est résolu via le conteneur (services,
 * jobs de la queue `sync`) parle alors à ce faux.
 */
export function useFakeStorage(group: Group): { readonly driver: FakeStorageDriver } {
  const state = { driver: new FakeStorageDriver() }

  group.each.setup(() => {
    state.driver = new FakeStorageDriver()
    app.container.swap(StorageDriver, () => state.driver)
    return () => app.container.restore(StorageDriver)
  })

  return {
    get driver() {
      return state.driver
    },
  }
}

/**
 * Fichier uploadé factice : le contenu est écrit pour de vrai dans `tmp/`
 * (le service le relit comme un fichier de requête). Deux contenus identiques
 * donnent deux fichiers distincts mais le même checksum.
 */
export async function uploadedFile(
  content: string | Buffer,
  extension = 'png'
): Promise<MultipartFile> {
  const directory = app.tmpPath('storage-tests')
  await mkdir(directory, { recursive: true })
  const tmpPath = `${directory}/${randomUUID()}.${extension}`
  await writeFile(tmpPath, content)
  return {
    tmpPath,
    clientName: `upload.${extension}`,
    extname: extension,
    type: 'image',
    subtype: extension,
  } as MultipartFile
}

export function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex')
}
