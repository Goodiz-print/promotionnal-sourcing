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
 * Traduction automatique idempotente d'une entité vers plusieurs locales.
 *
 * - **Un seul appel IA** pour toutes les locales à (re)traduire (#75). Une
 *   locale déjà à jour n'entre pas dans l'appel.
 * - **Clé d'idempotence par locale** = hash de (type d'entité, id, champs,
 *   locale source, locale cible, hash du texte source, modèle, version du
 *   prompt), stockée dans `translation_key`. Clé inchangée → pas d'appel.
 * - **Traduction manuelle protégée** : une ligne sans `translation_key` a été
 *   saisie par le fournisseur ; elle n'est jamais écrasée.
 * - **Upsert** sur `(entité, locale)` en une seule requête, après réception de
 *   la réponse : un crash ne refacture pas un appel déjà enregistré.
 *
 * Accès par `db` (pas de modèle Lucid) : le service est utilisé depuis un job.
 */
@inject()
export default class TranslationService {
  constructor(private provider: TranslationProvider) {}

  async translate(target: TranslationTarget): Promise<TranslationOutcome> {
    const { entity, entityId, sourceLocale } = target
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

    const targetLocales = [...new Set(target.targetLocales)].filter(
      (locale) => locale !== sourceLocale
    )
    const existing = await db
      .from(table)
      .where(foreignKey, entityId)
      .whereIn('locale', targetLocales)
      .select('locale', 'translation_key')
    const existingByLocale = new Map(existing.map((row) => [row.locale, row.translation_key]))

    const keys = new Map<string, string>()
    const pending: string[] = []
    for (const locale of targetLocales) {
      const key = this.keyFor(entity, entityId, sourceFields, sourceLocale, locale)
      keys.set(locale, key)

      if (!existingByLocale.has(locale)) {
        pending.push(locale)
        continue
      }
      const currentKey = existingByLocale.get(locale)
      if (currentKey === null) continue // saisie manuelle : protégée
      if (currentKey !== key) pending.push(locale)
    }

    const logContext = { entity, entityId, sourceLocale }
    if (pending.length === 0) {
      logger.info({ ...logContext, outcome: 'skipped', targetLocales }, 'ai translation')
      return 'skipped'
    }

    const translated = await this.provider.translate(sourceFields, sourceLocale, pending)

    const now = new Date()
    const rows = pending.map((locale) => ({
      [foreignKey]: entityId,
      locale,
      ...translated[locale],
      translation_key: keys.get(locale),
      created_at: now,
      updated_at: now,
    }))
    await db
      .table(table)
      .insert(rows)
      .onConflict([foreignKey, 'locale'])
      .merge([...Object.keys(sourceFields), 'translation_key', 'updated_at'])

    logger.info({ ...logContext, outcome: 'called', targetLocales: pending }, 'ai translation')
    return 'called'
  }

  private keyFor(
    entity: TranslatableEntity,
    entityId: number,
    sourceFields: Record<string, string>,
    sourceLocale: string,
    targetLocale: string
  ): string {
    return idempotencyKey({
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
  }
}
