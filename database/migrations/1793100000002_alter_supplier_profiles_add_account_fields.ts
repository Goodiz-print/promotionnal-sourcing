import { BaseSchema } from '@adonisjs/lucid/schema'
import {
  CATALOGUE_SOURCE_FORMATS,
  CATALOGUE_UPDATE_FREQUENCIES,
  CATALOGUE_UPDATE_MODES,
  REPORT_FREQUENCIES,
  SUPPLIER_COMMERCIAL_STATUSES,
  SUPPLIER_COMPANY_TYPES,
} from '#shared/types/organization'

/**
 * Compte fournisseur : champs saisis par le fournisseur (type d'entreprise,
 * pays livrés, langues du service commercial, email des devis, catalogue…) et
 * suivi commercial interne (statut, contact principal, partenaire fondateur,
 * notes — jamais exposés au fournisseur).
 */
export default class extends BaseSchema {
  protected tableName = 'supplier_profiles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('company_type', [...SUPPLIER_COMPANY_TYPES]).nullable()
      table.specificType('delivery_countries', 'text[]').nullable()
      table.specificType('spoken_languages', 'text[]').nullable()
      table.string('min_order_note', 255).nullable()
      table.string('quote_email', 254).nullable()
      table
        .enum('report_frequency', [...REPORT_FREQUENCIES])
        .notNullable()
        .defaultTo('none')
      table.enum('catalogue_update_mode', [...CATALOGUE_UPDATE_MODES]).nullable()
      table.enum('catalogue_update_frequency', [...CATALOGUE_UPDATE_FREQUENCIES]).nullable()

      // Suivi commercial interne
      table
        .enum('commercial_status', [...SUPPLIER_COMMERCIAL_STATUSES])
        .notNullable()
        .defaultTo(SUPPLIER_COMMERCIAL_STATUSES[0])
      table.string('primary_contact_name', 255).nullable()
      table.string('primary_contact_email', 254).nullable()
      table.boolean('is_founding_partner').notNullable().defaultTo(false)
      table.date('founding_partner_until').nullable()
      table.enum('catalogue_source_format', [...CATALOGUE_SOURCE_FORMATS]).nullable()
      table.text('internal_notes').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumns(
        'company_type',
        'delivery_countries',
        'spoken_languages',
        'min_order_note',
        'quote_email',
        'report_frequency',
        'catalogue_update_mode',
        'catalogue_update_frequency',
        'commercial_status',
        'primary_contact_name',
        'primary_contact_email',
        'is_founding_partner',
        'founding_partner_until',
        'catalogue_source_format',
        'internal_notes'
      )
    })
  }
}
