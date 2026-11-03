/**
 * Recherche par image : l'acheteur envoie une photo, un modèle vision la décrit
 * en mots-clés, et la recherche hybride du catalogue fait le reste (ADR 0002).
 * L'image n'est jamais stockée.
 */

/** Extensions acceptées à l'envoi. */
export const IMAGE_SEARCH_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const

/** Taille maximale de l'image envoyée. */
export const IMAGE_SEARCH_MAX_SIZE = '5mb'

/** Côté maximal (px) de l'image transmise au modèle : borne le coût de l'appel. */
export const IMAGE_SEARCH_MAX_DIMENSION = 1024

/** Longueur maximale de la requête générée. */
export const IMAGE_SEARCH_QUERY_MAX_LENGTH = 200

/** Paramètre de la page catalogue qui signale une recherche issue d'une image. */
export const IMAGE_SEARCH_QUERY_PARAM = 'imageSearch'

/** Résultat de la description d'une image. */
export interface ImageDescription {
  /** Mots-clés produit, dans la langue de l'acheteur, utilisés comme terme de recherche. */
  query: string
}
