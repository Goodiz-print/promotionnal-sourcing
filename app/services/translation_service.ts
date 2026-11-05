import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import emitter from '@adonisjs/core/services/emitter'
import ProductChanged from '#events/product_changed'
import aiConfig from '#config/ai'
import { MissingTranslationSourceError, TranslationTruncatedError } from '#exceptions/ai_errors'
import { idempotencyKey, textHash } from '#shared/helpers/idempotency'
import TranslationProvider from '#services/translation/translation_provider'
import AiCallService from '#services/ai_call_service'
import {
  ENTITY_TRANSLATION_TABLES as ENTITY_TABLES,
  type TranslatableEntity,
  type TranslationOutcome,
  type TranslationTarget,
  type TranslationUsage,
} from '#shared/types/ai'

/**
 * Traduction automatique idempotente d'une entité vers plusieurs locales.
 *
 * - **Un seul appel IA** pour toutes les locales à (re)traduire (#75). Une
 *   locale déjà à jour n'entre pas dans l'appel.
 * - **Clé d'idempotence par locale** = hash de (type d'entité, id, champs,
 *   locale source, locale cible, hash du texte source, modèle, version du
 *   prompt), stockée dans `translation_key`. Clé inchangée → pas d'appel.
 * - **Traduction manuelle protégée** : une ligne `is_auto = false` a été saisie
 *   par le fournisseur ; elle n'est jamais écrasée. Une ligne générée porte
 *   `is_auto = true`.
 * - **Upsert** sur `(entité, locale)` en une seule requête, après réception de
 *   la réponse : un crash ne refacture pas un appel déjà enregistré.
 *
 * Accès par `db` (pas de modèle Lucid) : le service est utilisé depuis un job.
 */
@inject()
export default class TranslationService {
  constructor(
    private provider: TranslationProvider,
    private aiCalls: AiCallService
  ) {}

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
      .select('locale', 'translation_key', 'is_auto')
    const existingByLocale = new Map(existing.map((row) => [row.locale, row]))

    const keys = new Map<string, string>()
    const pending: string[] = []
    for (const locale of targetLocales) {
      const key = this.keyFor(entity, entityId, sourceFields, sourceLocale, locale)
      keys.set(locale, key)

      const current = existingByLocale.get(locale)
      if (!current) {
        pending.push(locale)
        continue
      }
      if (!current.is_auto) continue // saisie manuelle : protégée
      if (current.translation_key !== key) pending.push(locale)
    }

    const logContext = { entity, entityId, sourceLocale }
    if (pending.length === 0) {
      logger.info({ ...logContext, outcome: 'skipped', targetLocales }, 'ai translation')
      return 'skipped'
    }

    let written = false
    try {
      // Un seul appel pour toutes les langues en cas normal ; une réponse tronquée
      // par le plafond de sortie coupe le lot en deux. Chaque lot réussi est écrit
      // tout de suite : un échec plus tard ne perd pas le travail déjà facturé.
      const batches: string[][] = [pending]
      while (batches.length > 0) {
        const batch = batches.shift()!
        let translated: Record<string, Record<string, string>>
        try {
          translated = await this.callProvider(target, sourceFields, batch)
        } catch (error) {
          if (error instanceof TranslationTruncatedError && batch.length > 1) {
            const middle = Math.ceil(batch.length / 2)
            batches.unshift(batch.slice(0, middle), batch.slice(middle))
            continue
          }
          throw error
        }
        await this.writeBatch(target, batch, translated, keys, Object.keys(sourceFields))
        written = true
      }
    } finally {
      if (written && entity === 'product') {
        await emitter.emit(ProductChanged, new ProductChanged(entityId))
      }
    }

    logger.info({ ...logContext, outcome: 'called', targetLocales: pending }, 'ai translation')
    return 'called'
  }

  /**
   * Appel du fournisseur, journalisé dans `ai_calls` (#177) : succès, réponse
   * tronquée ou échec, avec tokens et durée. L'enregistrement n'échoue jamais
   * l'appel (voir `AiCallService`).
   */
  private async callProvider(
    target: TranslationTarget,
    sourceFields: Record<string, string>,
    locales: string[]
  ): Promise<Record<string, Record<string, string>>> {
    const usage: TranslationUsage = { promptTokens: 0, completionTokens: 0 }
    const startedAt = Date.now()
    const record = (status: 'success' | 'truncated' | 'failed', error: string | null) =>
      this.aiCalls.record({
        service: 'translation',
        model: this.provider.model,
        entity: target.entity,
        entityId: target.entityId,
        sourceLocale: target.sourceLocale,
        targetLocales: locales,
        usage,
        durationMs: Date.now() - startedAt,
        status,
        error,
      })

    try {
      const translated = await this.provider.translate(
        sourceFields,
        target.sourceLocale,
        locales,
        usage
      )
      await record('success', null)
      return translated
    } catch (error) {
      const truncated = error instanceof TranslationTruncatedError
      await record(truncated ? 'truncated' : 'failed', (error as Error).message)
      throw error
    }
  }

  /**
   * Upsert d'un lot sur `(entité, locale)`, en une requête. La garde `is_auto` est
   * évaluée **au moment du conflit** : une traduction saisie à la main pendant
   * l'appel IA (`is_auto = false`) n'est jamais écrasée.
   */
  private async writeBatch(
    target: TranslationTarget,
    locales: string[],
    translated: Record<string, Record<string, string>>,
    keys: Map<string, string>,
    fields: string[]
  ): Promise<void> {
    const { table, foreignKey } = ENTITY_TABLES[target.entity]
    const now = new Date()
    const rows = locales.map((locale) => ({
      [foreignKey]: target.entityId,
      locale,
      ...translated[locale],
      translation_key: keys.get(locale),
      is_auto: true,
      created_at: now,
      updated_at: now,
    }))
    // Client Knex sous-jacent : le builder d'insertion de Lucid n'expose pas le
    // `WHERE` d'un `ON CONFLICT DO UPDATE`.
    await db
      .connection()
      .getWriteClient()(table)
      .insert(rows)
      .onConflict([foreignKey, 'locale'])
      .merge([...fields, 'translation_key', 'is_auto', 'updated_at'])
      .where(`${table}.is_auto`, true)
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
