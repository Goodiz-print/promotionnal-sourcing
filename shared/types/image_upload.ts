/**
 * Règles d'envoi d'une image par un utilisateur, communes à la galerie produit
 * et à la recherche par image.
 */

/** Extensions d'image acceptées. */
export const IMAGE_UPLOAD_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const

/** Taille maximale d'une image (la limite globale du body reste 20 Mo, cf. `config/bodyparser.ts`). */
export const IMAGE_UPLOAD_MAX_SIZE = '5mb'
