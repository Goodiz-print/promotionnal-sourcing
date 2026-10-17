import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3'
import storageConfig from '#config/storage'
import StorageDriver from '#services/storage/storage_driver'

/**
 * Implémentation Cellar (Clever Cloud) de `StorageDriver`, via l'API S3 en
 * *path-style*. Les objets sont écrits en `public-read` : les images du
 * catalogue sont servies directement depuis le bucket.
 */
export default class CellarStorageDriver extends StorageDriver {
  private client: S3Client | null = null

  async put(key: string, content: Buffer, mimeType: string): Promise<void> {
    await this.s3().send(
      new PutObjectCommand({
        Bucket: storageConfig.bucket,
        Key: key,
        Body: content,
        ContentType: mimeType,
        ACL: 'public-read',
      })
    )
  }

  async delete(key: string): Promise<void> {
    // S3 répond 204 pour une clé absente : supprimer l'inexistant est un succès.
    await this.s3().send(new DeleteObjectCommand({ Bucket: storageConfig.bucket, Key: key }))
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.s3().send(new HeadObjectCommand({ Bucket: storageConfig.bucket, Key: key }))
      return true
    } catch (error) {
      if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) {
        return false
      }
      throw error
    }
  }

  url(key: string): string {
    return `${storageConfig.endpoint}/${storageConfig.bucket}/${key}`
  }

  /**
   * Client créé à la première utilisation : le driver reste instanciable sans
   * réseau ni identifiants valides (tests, boot).
   */
  private s3(): S3Client {
    this.client ??= new S3Client({
      endpoint: storageConfig.endpoint,
      region: storageConfig.region,
      forcePathStyle: true,
      // Cellar n'accepte pas les checksums CRC32 ajoutés par défaut depuis le
      // SDK v3.729 : on ne les calcule/valide que lorsque l'opération l'exige.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      credentials: {
        accessKeyId: storageConfig.accessKeyId,
        secretAccessKey: storageConfig.secretAccessKey,
      },
    })
    return this.client
  }
}
