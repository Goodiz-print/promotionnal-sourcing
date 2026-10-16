/**
 * Token d'injection (classe abstraite) du traducteur. Lié à
 * `MistralTranslationProvider` dans `providers/ai_provider.ts`.
 */
export default abstract class TranslationProvider {
  /** Modèle utilisé (entre dans la clé d'idempotence). */
  abstract readonly model: string

  /**
   * Traduit chaque valeur de `fields` de `sourceLocale` vers `targetLocale` et
   * renvoie un objet de mêmes clés. Lève en cas d'échec API ou de réponse invalide.
   */
  abstract translate(
    fields: Record<string, string>,
    sourceLocale: string,
    targetLocale: string
  ): Promise<Record<string, string>>
}
