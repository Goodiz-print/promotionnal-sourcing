/**
 * Cycle de vie d'une ligne `storage_objects` :
 * - `pending_upload` : ligne posée **avant** l'envoi (trace en cas de crash) ;
 * - `ready` : l'objet est stocké et réutilisable (dédoublonnage par checksum) ;
 * - `pending_delete` : pierre tombale — l'ancienne clé attend le job de purge.
 */
export const STORAGE_STATUSES = ['pending_upload', 'ready', 'pending_delete'] as const
export type StorageStatus = (typeof STORAGE_STATUSES)[number]

/**
 * Colonnes qui référencent `storage_objects.id`. Un objet n'est supprimable
 * que si aucune de ces colonnes ne le désigne : toute nouvelle table qui porte
 * un fichier doit être ajoutée ici.
 */
export const STORAGE_REFERENCES = [
  { table: 'product_images', column: 'storage_object_id' },
  { table: 'product_image_variants', column: 'storage_object_id' },
  { table: 'organizations', column: 'logo_storage_object_id' },
  { table: 'organizations', column: 'banner_storage_object_id' },
  { table: 'supplier_news', column: 'image_storage_object_id' },
  { table: 'organization_documents', column: 'storage_object_id' },
  { table: 'product_documents', column: 'storage_object_id' },
] as const

/**
 * Une ligne `pending_upload` plus récente que ceci est considérée comme un
 * envoi en cours (un second envoi identique est refusé) ; au-delà, elle est
 * reprise par le nouvel appelant.
 */
export const STORAGE_PENDING_UPLOAD_TIMEOUT_MINUTES = 10

/**
 * Âge à partir duquel le job de reprise nettoie une ligne `pending_upload`
 * (ou une pierre tombale dont le job de purge s'est perdu).
 */
export const STORAGE_RECOVERY_THRESHOLD_HOURS = 24

/**
 * Contenu prêt à être stocké : tout ce qui détermine la clé est dérivé du
 * contenu (jamais d'un identifiant aléatoire — cela casserait le dédoublonnage).
 */
export interface PreparedUpload {
  key: string
  checksum: string
  mimeType: string
  size: number
  content: Buffer
}
