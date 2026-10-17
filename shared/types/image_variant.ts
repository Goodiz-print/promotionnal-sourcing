/**
 * Variantes générées à l'upload pour chaque image de galerie (Cellar ne
 * redimensionne pas à la volée). La largeur est un maximum : une image plus
 * petite n'est jamais agrandie.
 */
export const IMAGE_VARIANTS = [
  { name: 'card', width: 400 },
  { name: 'detail', width: 800 },
  { name: 'zoom', width: 1600 },
] as const

export type ImageVariantName = (typeof IMAGE_VARIANTS)[number]['name']

/**
 * Variante d'une image (sérialisée pour le frontend). Déclaré en `type` —
 * contrainte props Inertia `Record<string, JSONDataTypes>`.
 */
export type ImageVariantType = {
  name: ImageVariantName
  url: string
  width: number
  height: number
}
