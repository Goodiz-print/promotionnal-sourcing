import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Attribute from '#models/attribute'
import AttributeTranslation from '#models/attribute_translation'
import AttributeValue from '#models/attribute_value'
import AttributeValueTranslation from '#models/attribute_value_translation'
import TranslationQueueService from '#services/translation_queue_service'
import {
  AttributeInUseException,
  AttributeValueInUseException,
  duplicateAttributeValueSlug,
} from '#exceptions/catalogue_errors'
import { missingSourceTranslation } from '#exceptions/translation_errors'
import { CONTENT_LOCALES, type ContentLocale } from '#shared/types/i18n'
import type {
  CreateAttributeData,
  CreateAttributeValueData,
  UpdateAttributeData,
  UpdateAttributeValueData,
} from '#shared/types/attribute'

/**
 * Administration des facettes du catalogue (#48) : attributs (couleur, matière,
 * grammage…) et leurs valeurs. Données globales, réservées à l'admin plateforme.
 * Toute la logique ORM vit ici (controllers fins).
 *
 * Les traductions saisies sont marquées `is_auto = false` ; les autres langues
 * sont générées à partir de la langue source (#75, `TranslationQueueService`).
 * Le `slug` et le `type` d'un attribut, le `slug` d'une valeur, sont figés à la
 * création.
 */
@inject()
export default class AttributeService {
  constructor(private translationQueue: TranslationQueueService) {}

  /**
   * Liste d'administration : facettes triées par slug, avec le nombre de valeurs
   * et le nombre de produits qui les renseignent (`$extras.products_count`).
   */
  async listForAdmin(): Promise<Attribute[]> {
    const attributes = await Attribute.query()
      .preload('translations')
      .withCount('values')
      .orderBy('slug')

    const usage = await db
      .from('product_attributes')
      .select('attribute_id')
      .countDistinct('product_id as total')
      .groupBy('attribute_id')
    const totals = new Map(usage.map((row) => [Number(row.attribute_id), Number(row.total)]))
    for (const attribute of attributes) {
      attribute.$extras.products_count = totals.get(attribute.id) ?? 0
    }
    return attributes
  }

  /**
   * Facette pour l'édition : traductions et valeurs (avec leurs traductions et
   * le nombre de produits qui les portent, `$extras.products_count`). `null` si
   * introuvable.
   */
  async findForEdit(id: number): Promise<Attribute | null> {
    const attribute = await Attribute.query()
      .where('id', id)
      .preload('translations')
      .preload('values', (values) => values.preload('translations').orderBy('slug'))
      .first()
    if (!attribute) return null

    const usage = await db
      .from('product_attributes')
      .whereIn(
        'attribute_value_id',
        attribute.values.map((value) => value.id)
      )
      .select('attribute_value_id')
      .countDistinct('product_id as total')
      .groupBy('attribute_value_id')
    const totals = new Map(usage.map((row) => [Number(row.attribute_value_id), Number(row.total)]))
    for (const value of attribute.values) {
      value.$extras.products_count = totals.get(value.id) ?? 0
    }
    return attribute
  }

  findById(id: number): Promise<Attribute | null> {
    return Attribute.find(id)
  }

  /**
   * Valeur `valueId` de `attribute`, traductions préchargées. `null` si elle
   * n'appartient pas à cet attribut.
   */
  findValue(attribute: Attribute, valueId: number): Promise<AttributeValue | null> {
    return AttributeValue.query()
      .where('id', valueId)
      .where('attributeId', attribute.id)
      .preload('translations')
      .first()
  }

  async create(data: CreateAttributeData): Promise<Attribute> {
    if (!data.translations[data.sourceLocale]) throw missingSourceTranslation(data.sourceLocale)

    const attribute = await db.transaction(async (trx) => {
      const created = await Attribute.create(
        {
          slug: data.slug,
          type: data.type,
          unit: data.unit ?? null,
          isFilterable: data.isFilterable ?? true,
          sourceLocale: data.sourceLocale,
        },
        { client: trx }
      )
      await this.writeAttributeTranslations(created, data.translations, trx)
      return created
    })
    await this.translationQueue.queue('attribute', attribute.id, data.sourceLocale)
    return attribute
  }

  /**
   * Mise à jour partielle (unité, filtrabilité, traductions). Seul ce qui est
   * fourni est modifié.
   */
  async update(attribute: Attribute, data: UpdateAttributeData): Promise<Attribute> {
    const sourceLocale = (data.sourceLocale ?? attribute.sourceLocale) as ContentLocale
    if (!data.translations?.[sourceLocale]?.name) {
      const existing = await AttributeTranslation.query()
        .where('attributeId', attribute.id)
        .where('locale', sourceLocale)
        .first()
      if (!existing) throw missingSourceTranslation(sourceLocale)
    }

    await db.transaction(async (trx) => {
      attribute.useTransaction(trx)
      attribute.sourceLocale = sourceLocale
      if (data.unit !== undefined) attribute.unit = data.unit
      if (data.isFilterable !== undefined) attribute.isFilterable = data.isFilterable
      await attribute.save()
      await this.writeAttributeTranslations(attribute, data.translations, trx)
    })
    await this.translationQueue.queue('attribute', attribute.id, sourceLocale)
    return attribute
  }

  /**
   * Supprime la facette (traductions et valeurs partent en cascade DB). Refusé
   * si des produits la renseignent ou si une catégorie l'a retenue.
   */
  async delete(attribute: Attribute): Promise<void> {
    if (await this.exists('product_attributes', 'attribute_id', attribute.id)) {
      throw new AttributeInUseException('products')
    }
    if (await this.exists('category_attributes', 'attribute_id', attribute.id)) {
      throw new AttributeInUseException('categories')
    }
    await attribute.delete()
  }

  async createValue(attribute: Attribute, data: CreateAttributeValueData): Promise<AttributeValue> {
    if (!data.translations[data.sourceLocale]) throw missingSourceTranslation(data.sourceLocale)

    const taken = await AttributeValue.query()
      .where('attributeId', attribute.id)
      .where('slug', data.slug)
      .first()
    if (taken) throw duplicateAttributeValueSlug()

    const value = await db.transaction(async (trx) => {
      const created = await AttributeValue.create(
        {
          attributeId: attribute.id,
          slug: data.slug,
          value: data.slug,
          synonyms: data.synonyms ?? [],
          sourceLocale: data.sourceLocale,
        },
        { client: trx }
      )
      await this.writeValueTranslations(created, data.translations, trx)
      return created
    })
    await this.translationQueue.queue('attribute_value', value.id, data.sourceLocale)
    return value
  }

  async updateValue(
    value: AttributeValue,
    data: UpdateAttributeValueData
  ): Promise<AttributeValue> {
    const sourceLocale = (data.sourceLocale ?? value.sourceLocale) as ContentLocale
    if (!data.translations?.[sourceLocale]?.label) {
      const existing = await AttributeValueTranslation.query()
        .where('attributeValueId', value.id)
        .where('locale', sourceLocale)
        .first()
      if (!existing) throw missingSourceTranslation(sourceLocale)
    }

    await db.transaction(async (trx) => {
      value.useTransaction(trx)
      value.sourceLocale = sourceLocale
      if (data.synonyms !== undefined) value.synonyms = data.synonyms
      await value.save()
      await this.writeValueTranslations(value, data.translations, trx)
    })
    await this.translationQueue.queue('attribute_value', value.id, sourceLocale)
    return value
  }

  /**
   * Supprime une valeur. Refusé si des produits la portent ou si des nuances de
   * couleur lui sont rattachées (`parent_value_id`).
   */
  async deleteValue(value: AttributeValue): Promise<void> {
    if (await this.exists('product_attributes', 'attribute_value_id', value.id)) {
      throw new AttributeValueInUseException('products')
    }
    if (await this.exists('attribute_values', 'parent_value_id', value.id)) {
      throw new AttributeValueInUseException('children')
    }
    await value.delete()
  }

  private async exists(table: string, column: string, id: number): Promise<boolean> {
    const row = await db.from(table).where(column, id).select('id').first()
    return row !== null
  }

  /**
   * Écrit les noms **saisis** (`is_auto = false`). Une ligne inchangée garde son
   * marquage ; une langue absente du payload n'est pas touchée.
   */
  private async writeAttributeTranslations(
    attribute: Attribute,
    translations: UpdateAttributeData['translations'],
    trx: TransactionClientContract
  ): Promise<void> {
    if (!translations) return
    for (const locale of CONTENT_LOCALES) {
      const name = translations[locale]?.name
      if (!name) continue

      const existing = await AttributeTranslation.query({ client: trx })
        .where('attributeId', attribute.id)
        .where('locale', locale)
        .first()
      if (!existing) {
        await AttributeTranslation.create(
          { attributeId: attribute.id, locale, name, isAuto: false },
          { client: trx }
        )
      } else if (existing.name !== name) {
        await existing.useTransaction(trx).merge({ name, isAuto: false }).save()
      }
    }
  }

  /**
   * Écrit les libellés **saisis** d'une valeur (`is_auto = false`), comme
   * `writeAttributeTranslations`.
   */
  private async writeValueTranslations(
    value: AttributeValue,
    translations: UpdateAttributeValueData['translations'],
    trx: TransactionClientContract
  ): Promise<void> {
    if (!translations) return
    for (const locale of CONTENT_LOCALES) {
      const label = translations[locale]?.label
      if (!label) continue

      const existing = await AttributeValueTranslation.query({ client: trx })
        .where('attributeValueId', value.id)
        .where('locale', locale)
        .first()
      if (!existing) {
        await AttributeValueTranslation.create(
          { attributeValueId: value.id, locale, label, isAuto: false },
          { client: trx }
        )
      } else if (existing.label !== label) {
        await existing.useTransaction(trx).merge({ label, isAuto: false }).save()
      }
    }
  }
}
