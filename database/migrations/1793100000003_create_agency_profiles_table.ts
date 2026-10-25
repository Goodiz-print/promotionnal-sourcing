import { BaseSchema } from '@adonisjs/lucid/schema'
import { AGENCY_ACTIVITIES, AGENCY_PURCHASE_VOLUMES, AGENCY_TEAM_SIZES } from '#shared/types/agency'

/**
 * Profil d'une organisation acheteur de type agence : activité déclarée à
 * l'inscription, puis profil facultatif qui qualifie le lead pour les
 * fournisseurs (taille, volume d'achat, secteurs, marge par défaut des plaquettes).
 */
export default class extends BaseSchema {
  protected tableName = 'agency_profiles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('organization_id')
        .unsigned()
        .notNullable()
        .unique()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      table.enum('activity', [...AGENCY_ACTIVITIES]).notNullable()
      table.string('activity_other', 255).nullable()
      table.enum('team_size', [...AGENCY_TEAM_SIZES]).nullable()
      table.enum('purchase_volume', [...AGENCY_PURCHASE_VOLUMES]).nullable()
      table.specificType('client_sectors', 'text[]').nullable()
      table.decimal('default_margin_percent', 5, 2).nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
