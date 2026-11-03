import vine from '@vinejs/vine'
import { IMAGE_SEARCH_EXTENSIONS, IMAGE_SEARCH_MAX_SIZE } from '#shared/types/image_search'

/**
 * Photo envoyée pour la recherche par image : `jpg`/`png`/`webp`, 5 Mo. Le
 * contenu est ensuite vérifié par le décodage (`ImageSearchService`).
 */
export const imageSearchValidator = vine.create({
  image: vine.file({ size: IMAGE_SEARCH_MAX_SIZE, extnames: [...IMAGE_SEARCH_EXTENSIONS] }),
})
