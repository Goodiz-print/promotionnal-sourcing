import vine from '@vinejs/vine'
import { IMAGE_UPLOAD_EXTENSIONS, IMAGE_UPLOAD_MAX_SIZE } from '#shared/types/image_upload'

/**
 * Photo envoyée pour la recherche par image : `jpg`/`png`/`webp`, 5 Mo. Le
 * contenu est ensuite vérifié par le décodage (`ImageSearchService`).
 */
export const imageSearchValidator = vine.create({
  image: vine.file({ size: IMAGE_UPLOAD_MAX_SIZE, extnames: [...IMAGE_UPLOAD_EXTENSIONS] }),
})
