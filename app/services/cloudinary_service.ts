import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import cloudinary from '#config/cloudinary'
import { CloudinaryUploadException } from '#exceptions/upload_errors'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import type { UploadApiResponse } from 'cloudinary'

/**
 * Asset Cloudinary sérialisé pour la persistance (une ligne `product_images`).
 */
export interface UploadedAsset {
  secureUrl: string
  publicId: string
  width: number | null
  height: number | null
}

/**
 * Sous-ensemble de l'API Cloudinary utilisé par le service. Exposé comme
 * couture d'injection : les tests unitaires passent un faux uploader (aucun
 * appel réseau réel).
 */
export interface CloudinaryUploader {
  upload(file: string, options: { folder: string }): Promise<UploadApiResponse>
  destroy(publicId: string): Promise<{ result: string }>
}

/**
 * Upload et suppression d'images sur Cloudinary. Pensé multi-fichiers
 * (`uploadMany`) et responsable du nettoyage des assets remplacés/supprimés.
 */
export default class CloudinaryService {
  constructor(
    private uploader: CloudinaryUploader = cloudinary.uploader as unknown as CloudinaryUploader
  ) {}

  /**
   * Dossier de stockage imposé : `promotionnal-sourcing/<environnement>/<sous-dossier>`
   * (ex. `promotionnal-sourcing/production/products/mon-produit`). Isole les
   * assets par environnement (`NODE_ENV`).
   */
  folderFor(subfolder: string): string {
    return `promotionnal-sourcing/${env.get('NODE_ENV')}/${subfolder}`
  }

  /**
   * Upload d'un fichier unique. `subfolder` est relatif au préfixe imposé.
   */
  async upload(file: MultipartFile, subfolder: string): Promise<UploadedAsset> {
    if (!file.tmpPath) {
      throw new CloudinaryUploadException('Fichier temporaire introuvable')
    }

    try {
      const response = await this.uploader.upload(file.tmpPath, {
        folder: this.folderFor(subfolder),
      })

      return {
        secureUrl: response.secure_url,
        publicId: response.public_id,
        width: response.width ?? null,
        height: response.height ?? null,
      }
    } catch (error) {
      logger.error({ err: error }, 'Cloudinary upload failed')
      throw new CloudinaryUploadException()
    }
  }

  /**
   * Upload de plusieurs fichiers en parallèle (galerie).
   */
  uploadMany(files: MultipartFile[], subfolder: string): Promise<UploadedAsset[]> {
    return Promise.all(files.map((file) => this.upload(file, subfolder)))
  }

  /**
   * Supprime un asset. Le nettoyage ne bloque pas le flux métier :
   * un échec est loggé, pas propagé.
   */
  async destroy(publicId: string): Promise<void> {
    try {
      await this.uploader.destroy(publicId)
    } catch (error) {
      logger.error({ err: error, publicId }, 'Cloudinary destroy failed')
    }
  }

  /**
   * Supprime plusieurs assets en parallèle.
   */
  async destroyMany(publicIds: string[]): Promise<void> {
    await Promise.all(publicIds.map((publicId) => this.destroy(publicId)))
  }
}
