/**
 * Abstraction du stockage objet. Classe abstraite (et non interface) : c'est
 * le **token d'injection** du conteneur IoC, lié à son implémentation dans
 * `providers/storage_provider.ts`. Les tests la remplacent par un faux via
 * `container.swap(StorageDriver, …)`.
 */
export default abstract class StorageDriver {
  /**
   * Écrit (ou réécrit à l'identique) l'objet. Idempotent : la clé dérive du
   * contenu.
   */
  abstract put(key: string, content: Buffer, mimeType: string): Promise<void>

  /**
   * Supprime l'objet. Supprimer un objet absent est un succès.
   */
  abstract delete(key: string): Promise<void>

  abstract exists(key: string): Promise<boolean>

  /**
   * URL publique de l'objet.
   */
  abstract url(key: string): string
}
