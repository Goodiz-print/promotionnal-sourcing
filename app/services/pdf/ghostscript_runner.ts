/**
 * Contrat du compresseur PDF (#60). Token d'injection : la classe abstraite est
 * liée à `ProcessGhostscriptRunner` dans `providers/pdf_provider.ts`. Les tests
 * remplacent cette liaison par un faux, sans lancer de processus.
 */
export default abstract class GhostscriptRunner {
  /** Vrai si le binaire est disponible sur ce système. */
  abstract available(): Promise<boolean>

  /**
   * Compresse un PDF (profil `/ebook`). Lève si le binaire échoue ou produit
   * une sortie vide : l'appelant décide du repli.
   */
  abstract compress(content: Buffer): Promise<Buffer>
}
