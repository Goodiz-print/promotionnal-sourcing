/**
 * Recherche par image : l'acheteur envoie une photo, un modèle vision la décrit
 * en mots-clés, et la recherche hybride du catalogue fait le reste (ADR 0002).
 * L'image n'est jamais stockée.
 */

/** Côté maximal (px) de l'image transmise au modèle : borne le coût de l'appel. */
export const IMAGE_SEARCH_MAX_DIMENSION = 1024

/**
 * Nombre maximal de pixels décodés (≈ 40 Mpx). Un PNG ou WebP très compressible
 * peut tenir sous 5 Mo tout en déclarant des centaines de mégapixels : sharp
 * refuse alors l'image avant de la décoder.
 */
export const IMAGE_SEARCH_MAX_INPUT_PIXELS = 40_000_000

/** Longueur maximale de la requête générée. */
export const IMAGE_SEARCH_QUERY_MAX_LENGTH = 200

/**
 * Clé de flash qui porte le terme généré jusqu'à la page catalogue. Elle ne
 * vit que le temps de la redirection : contrairement à un paramètre d'URL, un
 * visiteur ne peut ni la poser lui-même ni la partager dans un lien.
 */
export const IMAGE_SEARCH_FLASH_KEY = 'imageSearchQuery'

/** Résultat de la description d'une image. */
export interface ImageDescription {
  /** Mots-clés produit, dans la langue de l'acheteur, utilisés comme terme de recherche. */
  query: string
}
