import { BaseSchema } from '@adonisjs/lucid/schema'
import { LEGAL_CONSENT_KINDS } from '#shared/types/legal'

/**
 * Journal horodaté des consentements et signatures électroniques (CGU, licence
 * de données, marketing…) : version du texte, date et IP conservées comme
 * preuve juridique. Append-only — un retrait de consentement pose `revoked_at`
 * plutôt que de supprimer la ligne.
 */
export default class extends BaseSchema {
  protected tableName = 'legal_consents'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('organization_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      table
        .integer('user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.enum('kind', [...LEGAL_CONSENT_KINDS]).notNullable()
      table.string('version', 50).notNullable()
      table.string('ip_address', 45).nullable()
      table.timestamp('accepted_at').notNullable()
      table.timestamp('revoked_at').nullable()
      table.timestamp('created_at').notNullable()

      table.index(['organization_id', 'kind'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
