import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import aiConfig from '#config/ai'
import { MissingTranslationSourceError } from '#exceptions/ai_errors'
import { idempotencyKey, textHash } from '#shared/helpers/idempotency'
import TranslationProvider from '#services/translation/translation_provider'
import type { TranslatableEntity, TranslationOutcome, TranslationTarget } from '#shared/types/ai'

interface EntityTable {
  table: string
  foreignKey: string
  fields: readonly string[]
}

/** Tables de traduction et champs texte traduits, par type d'entité. */
const ENTITY_TABLES: Record<TranslatableEntity, EntityTable> = {
  product: {
    table: 'product_translations',
    foreignKey: 'product_id',
    fields: ['name', 'description'],
  },
  category: { table: 'category_translations', foreignKey: 'category_id', fields: ['name'] },
  attribute: { table: 'attribute_translations', foreignKey: 'attribute_id', fields: ['name'] },
  attribute_value: {
    table: 'attribute_value_translations',
    foreignKey: 'attribute_value_id',
    fields: ['label'],
  },
}

/**
 * Traduction automatique idempotente d'une entité vers une locale.
 *
 * - **Clé d'idempotence** = hash de (type d'entité, id, champs, locale source,
 *   locale cible, hash du texte source, modèle, version du prompt), stockée dans
 *   `translation_key` sur la ligne de traduction. Clé inchangée → Mistral n'est
 *   pas appelé.
 * - **Upsert** sur `(entité, locale)` : une seule traduction par couple.
 * - Le résultat Mistral est écrit en **une seule** requête (texte + clé), avant
 *   toute autre écriture : un crash ne refacture pas l'appel déjà enregistré.
 * - Chaque appel est loggé avec sa clé (`outcome` = `called` | `skipped`).
 *
 * Accès par `db` (pas de modèle Lucid) : le service est utilisé depuis un job.
 */
@inject()
export default class TranslationService {
  constructor(private provider: TranslationProvider) {}

  async translate(target: TranslationTarget): Promise<TranslationOutcome> {
    const { entity, entityId, sourceLocale, targetLocale } = target
    const { table, foreignKey, fields } = ENTITY_TABLES[entity]

    const source = await db
      .from(table)
      .where(foreignKey, entityId)
      .where('locale', sourceLocale)
      .first()
    if (!source) throw new MissingTranslationSourceError(entity, entityId, sourceLocale)

    const sourceFields: Record<string, string> = {}
    for (const field of fields) {
      const value = source[field]
      if (typeof value === 'string' && value.trim()) sourceFields[field] = value
    }
    if (Object.keys(sourceFields).length === 0) return 'skipped'

    const key = idempotencyKey({
      kind: 'translation',
      entity,
      entityId,
      fields: Object.keys(sourceFields),
      sourceLocale,
      targetLocale,
      sourceTextHash: textHash(JSON.stringify(sourceFields)),
      model: this.provider.model,
      promptVersion: aiConfig.translation.promptVersion,
    })

    const existing = await db
      .from(table)
      .where(foreignKey, entityId)
      .where('locale', targetLocale)
      .select('translation_key')
      .first()
    const logContext = { idempotencyKey: key, entity, entityId, sourceLocale, targetLocale }
    if (existing?.translation_key === key) {
      logger.info({ ...logContext, outcome: 'skipped' }, 'ai translation')
      return 'skipped'
    }

    const translated = await this.provider.translate(sourceFields, sourceLocale, targetLocale)

    const now = new Date()
    await db
      .table(table)
      .insert({
        [foreignKey]: entityId,
        locale: targetLocale,
        ...translated,
        translation_key: key,
        created_at: now,
        updated_at: now,
      })
      .onConflict([foreignKey, 'locale'])
      .merge({ ...translated, translation_key: key, updated_at: now })

    logger.info({ ...logContext, outcome: 'called' }, 'ai translation')
    return 'called'
  }
}
