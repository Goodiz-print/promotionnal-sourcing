import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Certification from '#models/certification'
import CertificationTranslation from '#models/certification_translation'
import AdminAuditService from '#services/admin_audit_service'
import TranslationQueueService from '#services/translation_queue_service'
import SearchSyncService from '#services/search_sync_service'
import { CertificationInUseException } from '#exceptions/catalogue_errors'
import { missingSourceTranslation } from '#exceptions/translation_errors'
import { CONTENT_LOCALES, type ContentLocale } from '#shared/types/i18n'
import type { AdminActionContext } from '#shared/types/admin_audit'
import type { CreateCertificationData, UpdateCertificationData } from '#shared/types/certification'

/**
 * Administration des certifications du catalogue (#165) : labels de conformité
 * (écart 4). Données globales, réservées à l'admin plateforme.
 *
 * Les traductions saisies sont marquées `is_auto = false` ; les autres langues
 * sont générées à partir de la langue source (`TranslationQueueService`).
 * Le `slug` est figé à la création.
 *
 * **Effets de bord** : modifier `is_eco` ou supprimer une certification change
 * la dérivation `products.is_eco` des produits concernés. Le recalcul passe par
 * `ProductEcoService` et la réindexation par `SearchSyncService` (jamais
 * d'appel Meilisearch dans la requête HTTP).
 */
@inject()
export default class CertificationService {
  constructor(
    private translationQueue: TranslationQueueService,
    private audit: AdminAuditService,
    private searchSync: SearchSyncService
  ) {}

  /**
   * Liste d'administration : certifications triées par slug, avec le nombre de
   * produits qui les portent (`$extras.products_count`).
   */
  async listForAdmin(): Promise<Certification[]> {
    const certifications = await Certification.query().preload('translations').orderBy('slug')

    const usage = await db
      .from('product_certifications')
      .select('certification_id')
      .count('* as total')
      .groupBy('certification_id')
    const totals = new Map(usage.map((row) => [Number(row.certification_id), Number(row.total)]))
    for (const certification of certifications) {
      certification.$extras.products_count = totals.get(certification.id) ?? 0
    }
    return certifications
  }

  /**
   * Certification pour l'édition : traductions préchargées. `null` si introuvable.
   */
  async findForEdit(id: number): Promise<Certification | null> {
    return Certification.query().where('id', id).preload('translations').first()
  }

  findById(id: number): Promise<Certification | null> {
    return Certification.find(id)
  }

  async create(data: CreateCertificationData, context: AdminActionContext): Promise<Certification> {
    if (!data.translations[data.sourceLocale]) throw missingSourceTranslation(data.sourceLocale)

    const certification = await db.transaction(async (trx) => {
      const created = await Certification.create(
        {
          slug: data.slug,
          domain: data.domain,
          isEco: data.isEco,
          synonyms: data.synonyms ?? [],
          sourceLocale: data.sourceLocale,
        },
        { client: trx }
      )
      await this.writeTranslations(created, data.translations, trx)
      await this.audit.record(
        {
          action: 'certification.created',
          targetType: 'certification',
          targetId: created.id,
          changes: { after: { slug: created.slug, domain: created.domain, isEco: created.isEco } },
        },
        { ...context, client: trx }
      )
      return created
    })
    await this.translationQueue.queue('certification', certification.id, data.sourceLocale)
    return certification
  }

  /**
   * Mise à jour partielle. Le slug est figé. Si `isEco` change, les produits
   * concernés sont réindexés après commit.
   */
  async update(
    certification: Certification,
    data: UpdateCertificationData,
    context: AdminActionContext
  ): Promise<Certification> {
    const sourceLocale = (data.sourceLocale ?? certification.sourceLocale) as ContentLocale
    if (!data.translations?.[sourceLocale]?.name) {
      const existing = await CertificationTranslation.query()
        .where('certificationId', certification.id)
        .where('locale', sourceLocale)
        .first()
      if (!existing) throw missingSourceTranslation(sourceLocale)
    }

    const snapshot = (source: Certification) => ({
      domain: source.domain,
      isEco: source.isEco,
      sourceLocale: source.sourceLocale,
    })
    const before = snapshot(certification)
    const wasEco = certification.isEco

    await db.transaction(async (trx) => {
      certification.useTransaction(trx)
      certification.sourceLocale = sourceLocale
      if (data.domain !== undefined) certification.domain = data.domain
      if (data.isEco !== undefined) certification.isEco = data.isEco
      if (data.synonyms !== undefined) certification.synonyms = data.synonyms
      await certification.save()
      await this.writeTranslations(certification, data.translations, trx)
      await this.audit.record(
        {
          action: 'certification.updated',
          targetType: 'certification',
          targetId: certification.id,
          changes: { before, after: snapshot(certification) },
        },
        { ...context, client: trx }
      )
    })
    await this.translationQueue.queue('certification', certification.id, sourceLocale)

    // Si is_eco a changé, recalculer et réindexer les produits concernés
    if (wasEco !== certification.isEco) {
      await this.reindexProductsWithCertification(certification.id)
    }

    return certification
  }

  /**
   * Supprime la certification. Refusée si des produits la portent.
   * Après suppression, les produits qui la portaient ont leur is_eco recalculé.
   */
  async delete(certification: Certification, context: AdminActionContext): Promise<void> {
    const productIds = await this.productIdsWithCertification(certification.id)
    if (productIds.length > 0) {
      throw new CertificationInUseException()
    }

    await db.transaction(async (trx) => {
      await certification.useTransaction(trx).delete()
      await this.audit.record(
        {
          action: 'certification.deleted',
          targetType: 'certification',
          targetId: certification.id,
          changes: { before: { slug: certification.slug, domain: certification.domain } },
        },
        { ...context, client: trx }
      )
    })
  }

  /**
   * IDs des produits portant cette certification.
   */
  private async productIdsWithCertification(certificationId: number): Promise<number[]> {
    const rows = await db
      .from('product_certifications')
      .where('certification_id', certificationId)
      .select('product_id')
    return rows.map((row) => row.product_id)
  }

  /**
   * Met en queue la réindexation des produits portant cette certification.
   * Appelé après changement de is_eco.
   */
  private async reindexProductsWithCertification(certificationId: number): Promise<void> {
    const productIds = await this.productIdsWithCertification(certificationId)
    for (const productId of productIds) {
      await this.searchSync.queueProduct(productId)
    }
  }

  /**
   * Écrit les noms **saisis** (`is_auto = false`). Une ligne inchangée garde son
   * marquage ; une langue absente du payload n'est pas touchée.
   */
  private async writeTranslations(
    certification: Certification,
    translations: UpdateCertificationData['translations'],
    trx: TransactionClientContract
  ): Promise<void> {
    if (!translations) return
    for (const locale of CONTENT_LOCALES) {
      const name = translations[locale]?.name
      if (!name) continue

      const existing = await CertificationTranslation.query({ client: trx })
        .where('certificationId', certification.id)
        .where('locale', locale)
        .first()
      if (!existing) {
        await CertificationTranslation.create(
          { certificationId: certification.id, locale, name, isAuto: false },
          { client: trx }
        )
      } else if (existing.name !== name) {
        await existing.useTransaction(trx).merge({ name, isAuto: false }).save()
      }
    }
  }
}
