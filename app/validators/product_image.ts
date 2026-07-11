import vine from '@vinejs/vine'

/**
 * Upload multi-fichiers de la galerie produit. Réutilisable par le futur écran
 * de gestion produit fournisseur (voir #2). Jusqu'à 8 images, `jpg`/`png`/`webp`,
 * 5 Mo chacune (la limite globale du body reste 20 Mo, cf. `config/bodyparser.ts`).
 */
export const productImagesValidator = vine.create({
  images: vine
    .array(vine.file({ size: '5mb', extnames: ['jpg', 'jpeg', 'png', 'webp'] }))
    .maxLength(8)
    .optional(),
})
