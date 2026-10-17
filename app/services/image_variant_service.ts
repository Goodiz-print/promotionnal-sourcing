import { inject } from '@adonisjs/core'
import sharp from 'sharp'
import ProductImage from '#models/product_image'
import ProductImageVariant from '#models/product_image_variant'
import StorageObject from '#models/storage_object'
import StorageDriver from '#services/storage/storage_driver'
import StorageService from '#services/storage/storage_service'
import { IMAGE_VARIANTS } from '#shared/types/image_variant'

const WEBP_QUALITY = 80

/**
 * Génère les variantes redimensionnées (carte, fiche, zoom) d'une image de
 * galerie : Cellar ne transforme rien à la volée. Appelé par
 * `GenerateImageVariantsJob` (qui le résout dans `execute()` : ce service
 * importe des modèles Lucid, cf. la règle DI de `CLAUDE.md`).
 *
 * Chaque variante est un objet `storage_objects` écrit via `StorageService`
 * (clé déterministe, dédoublonnage, zéro orphelin). Idempotent : une variante
 * déjà présente n'est pas régénérée, donc un job rejoué reprend où il s'est
 * arrêté.
 */
@inject()
export default class ImageVariantService {
  constructor(
    private storage: StorageService,
    private driver: StorageDriver
  ) {}

  /**
   * Génère les variantes manquantes de l'image. Sans effet si l'image (ou son
   * objet) a disparu entre-temps. Lève en cas d'échec — le job réessaie.
   */
  async generate(productImageId: number): Promise<void> {
    const image = await ProductImage.find(productImageId)
    if (!image?.storageObjectId) return

    const original = await StorageObject.query()
      .where('id', image.storageObjectId)
      .where('status', 'ready')
      .first()
    if (!original) return

    const existing = await ProductImageVariant.query().where('productImageId', image.id)
    const done = new Set(existing.map((variant) => variant.name))
    const missing = IMAGE_VARIANTS.filter((variant) => !done.has(variant.name))
    if (missing.length === 0) return

    const source = await this.driver.get(original.key)
    await this.recordDimensions(image, source)

    for (const variant of missing) {
      const { data, info } = await sharp(source)
        .rotate()
        .resize({ width: variant.width, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true })

      const object = await this.storage.storeContent(data, 'webp', 'image/webp')
      try {
        await ProductImageVariant.create({
          productImageId: image.id,
          name: variant.name,
          storageObjectId: object.id,
          url: this.storage.urlFor(object),
          width: info.width,
          height: info.height,
        })
      } catch (error) {
        await this.storage.discard([object.id])
        throw error
      }
    }
  }

  /**
   * Renseigne `width`/`height` de l'image d'origine (orientation EXIF prise en
   * compte) tant qu'ils sont inconnus.
   */
  private async recordDimensions(image: ProductImage, source: Buffer): Promise<void> {
    if (image.width && image.height) return

    const { width, height, orientation } = await sharp(source).metadata()
    if (!width || !height) return

    const rotated = (orientation ?? 1) >= 5
    await image.merge({ width: rotated ? height : width, height: rotated ? width : height }).save()
  }
}
