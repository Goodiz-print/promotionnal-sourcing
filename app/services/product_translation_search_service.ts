import db from '@adonisjs/lucid/services/db'
import { DEFAULT_TSCONFIG, LOCALE_TSCONFIG } from '#shared/types/i18n'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ContentLocale } from '#shared/types/i18n'

/**
 * Calcule `product_translations.search_vector` (colonne ordinaire, #84). La
 * config de recherche vient de `LOCALE_TSCONFIG`, seule source de vérité : toute
 * écriture de traduction doit appeler `refresh` (testé : aucune ligne à NULL).
 */
export default class ProductTranslationSearchService {
  /**
   * Recalcule le vecteur des traductions d'un produit (toutes locales).
   */
  async refreshForProduct(productId: number, trx?: TransactionClientContract): Promise<void> {
    const client = trx ?? db
    for (const [locale, config] of this.configs()) {
      await client.rawQuery(
        `UPDATE product_translations
         SET search_vector = to_tsvector(?::regconfig, coalesce(name, '') || ' ' || coalesce(description, ''))
         WHERE product_id = ? AND locale = ?`,
        [config, productId, locale]
      )
    }
    // Locales hors mapping : repli 'simple'.
    await client.rawQuery(
      `UPDATE product_translations
       SET search_vector = to_tsvector(?::regconfig, coalesce(name, '') || ' ' || coalesce(description, ''))
       WHERE product_id = ? AND locale NOT IN (${this.configs()
         .map(() => '?')
         .join(', ')})`,
      [DEFAULT_TSCONFIG, productId, ...this.configs().map(([locale]) => locale)]
    )
  }

  private configs(): Array<[ContentLocale, string]> {
    return Object.entries(LOCALE_TSCONFIG) as Array<[ContentLocale, string]>
  }
}
