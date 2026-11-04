import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import MarkingTechnique from '#models/marking_technique'
import MarkingTechniqueTranslation from '#models/marking_technique_translation'
import AdminAuditService from '#services/admin_audit_service'
import TranslationQueueService from '#services/translation_queue_service'
import SearchSyncService from '#services/search_sync_service'
import { MarkingTechniqueInUseException } from '#exceptions/catalogue_errors'
import { missingSourceTranslation } from '#exceptions/translation_errors'
import { CONTENT_LOCALES, type ContentLocale } from '#shared/types/i18n'
import type { AdminActionContext } from '#shared/types/admin_audit'
import type { CreateMarkingTechniqueData, UpdateMarkingTechniqueData } from '#shared/types/marking'

/**
 * Administration des techniques de marquage (#165). Données globales, réservées
 * à l'admin plateforme.
 *
 * Les traductions saisies sont marquées `is_auto = false` ; les autres langues
 * sont générées à partir de la langue source (`TranslationQueueService`).
 * Le `slug` est figé à la création.
 *
 * **Effets de bord** : renommer une technique de marquage change les documents
 * indexés si les libellés y figurent. `ProductIndexService` n'inclut pas
 * actuellement les noms de techniques dans l'index ; la réindexation n'est donc
 * pas déclenchée automatiquement (à revoir si l'index évolue).
 */
@inject()
export default class MarkingTechniqueService {
  constructor(
    private translationQueue: TranslationQueueService,
    private audit: AdminAuditService,
    // Injection préparée pour la réindexation future si les techniques sont indexées
    _searchSync: SearchSyncService
  ) {}

  /**
   * Liste d'administration : techniques triées par slug, avec le nombre de
   * produits qui les utilisent (`$extras.products_count`).
   */
  async listForAdmin(): Promise<MarkingTechnique[]> {
    const techniques = await MarkingTechnique.query().preload('translations').orderBy('slug')

    // Compte les utilisations dans les positions de marquage ET les paliers de prix
    const positionUsage = await db
      .from('product_marking_position_techniques')
      .select('marking_technique_id')
      .countDistinct('marking_position_id as total')
      .groupBy('marking_technique_id')
    const priceUsage = await db
      .from('product_marking_price_tiers')
      .select('marking_technique_id')
      .countDistinct('product_id as total')
      .groupBy('marking_technique_id')

    const totals = new Map<number, number>()
    for (const row of positionUsage) {
      const id = Number(row.marking_technique_id)
      totals.set(id, (totals.get(id) ?? 0) + Number(row.total))
    }
    for (const row of priceUsage) {
      const id = Number(row.marking_technique_id)
      totals.set(id, (totals.get(id) ?? 0) + Number(row.total))
    }
    for (const technique of techniques) {
      technique.$extras.products_count = totals.get(technique.id) ?? 0
    }
    return techniques
  }

  /**
   * Technique pour l'édition : traductions préchargées. `null` si introuvable.
   */
  async findForEdit(id: number): Promise<MarkingTechnique | null> {
    return MarkingTechnique.query().where('id', id).preload('translations').first()
  }

  findById(id: number): Promise<MarkingTechnique | null> {
    return MarkingTechnique.find(id)
  }

  async create(
    data: CreateMarkingTechniqueData,
    context: AdminActionContext
  ): Promise<MarkingTechnique> {
    if (!data.translations[data.sourceLocale]) throw missingSourceTranslation(data.sourceLocale)

    const technique = await db.transaction(async (trx) => {
      const created = await MarkingTechnique.create(
        {
          slug: data.slug,
          family: data.family,
          synonyms: data.synonyms ?? [],
          sourceLocale: data.sourceLocale,
        },
        { client: trx }
      )
      await this.writeTranslations(created, data.translations, data.sourceLocale, trx)
      await this.audit.record(
        {
          action: 'marking_technique.created',
          targetType: 'marking_technique',
          targetId: created.id,
          changes: { after: { slug: created.slug, family: created.family } },
        },
        { ...context, client: trx }
      )
      return created
    })
    await this.translationQueue.queue('marking_technique', technique.id, data.sourceLocale)
    return technique
  }

  /**
   * Mise à jour partielle. Le slug est figé.
   */
  async update(
    technique: MarkingTechnique,
    data: UpdateMarkingTechniqueData,
    context: AdminActionContext
  ): Promise<MarkingTechnique> {
    const sourceLocale = (data.sourceLocale ?? technique.sourceLocale) as ContentLocale
    if (!data.translations?.[sourceLocale]?.name) {
      const existing = await MarkingTechniqueTranslation.query()
        .where('markingTechniqueId', technique.id)
        .where('locale', sourceLocale)
        .first()
      if (!existing) throw missingSourceTranslation(sourceLocale)
    }

    const snapshot = (source: MarkingTechnique) => ({
      family: source.family,
    })
    const before = snapshot(technique)

    await db.transaction(async (trx) => {
      technique.useTransaction(trx)
      technique.sourceLocale = sourceLocale
      if (data.family !== undefined) technique.family = data.family
      if (data.synonyms !== undefined) technique.synonyms = data.synonyms
      await technique.save()
      await this.writeTranslations(technique, data.translations, sourceLocale, trx)
      await this.audit.record(
        {
          action: 'marking_technique.updated',
          targetType: 'marking_technique',
          targetId: technique.id,
          changes: { before, after: snapshot(technique) },
        },
        { ...context, client: trx }
      )
    })
    await this.translationQueue.queue('marking_technique', technique.id, sourceLocale)
    return technique
  }

  /**
   * Supprime la technique. Refusee si des produits l'utilisent (positions ou
   * paliers de prix de marquage). La verification est faite dans la transaction
   * avec verrou pour eviter les races.
   */
  async delete(technique: MarkingTechnique, context: AdminActionContext): Promise<void> {
    await db.transaction(async (trx) => {
      // Verrou sur la technique pour eviter les races
      await MarkingTechnique.query({ client: trx })
        .where('id', technique.id)
        .forUpdate()
        .firstOrFail()

      // Verifier l'usage dans la transaction
      if (await this.isInUseWithClient(technique.id, trx)) {
        throw new MarkingTechniqueInUseException()
      }

      await technique.useTransaction(trx).delete()
      await this.audit.record(
        {
          action: 'marking_technique.deleted',
          targetType: 'marking_technique',
          targetId: technique.id,
          changes: { before: { slug: technique.slug, family: technique.family } },
        },
        { ...context, client: trx }
      )
    })
  }

  /**
   * Verifie si la technique est utilisee par des produits (dans la transaction).
   */
  private async isInUseWithClient(
    techniqueId: number,
    client: TransactionClientContract
  ): Promise<boolean> {
    const positionRow = await client
      .from('product_marking_position_techniques')
      .where('marking_technique_id', techniqueId)
      .select('id')
      .first()
    if (positionRow) return true

    const priceRow = await client
      .from('product_marking_price_tiers')
      .where('marking_technique_id', techniqueId)
      .select('id')
      .first()
    return priceRow !== null
  }

  /**
   * Écrit les noms **saisis** (`is_auto = false`). La traduction de la langue
   * source est toujours marquée `is_auto = false`.
   */
  private async writeTranslations(
    technique: MarkingTechnique,
    translations: UpdateMarkingTechniqueData['translations'],
    _sourceLocale: ContentLocale,
    trx: TransactionClientContract
  ): Promise<void> {
    if (!translations) return
    for (const locale of CONTENT_LOCALES) {
      const name = translations[locale]?.name
      if (!name) continue

      const existing = await MarkingTechniqueTranslation.query({ client: trx })
        .where('markingTechniqueId', technique.id)
        .where('locale', locale)
        .first()
      if (!existing) {
        // Toute traduction saisie manuellement est marquée is_auto = false
        await MarkingTechniqueTranslation.create(
          { markingTechniqueId: technique.id, locale, name, isAuto: false },
          { client: trx }
        )
      } else if (existing.name !== name) {
        // La saisie manuelle marque toujours is_auto = false
        await existing.useTransaction(trx).merge({ name, isAuto: false }).save()
      }
    }
  }
}
