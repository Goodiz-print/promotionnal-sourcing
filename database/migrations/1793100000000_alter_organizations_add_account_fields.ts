import { BaseSchema } from '@adonisjs/lucid/schema'
import { SUBSCRIPTION_PLANS } from '#shared/types/organization'

/**
 * Informations de compte communes aux fournisseurs et aux agences (classeur
 * « Informations comptes fournisseurs / agences ») : vérification automatique
 * de la TVA (VIES) et du domaine de l'email, langue de travail, formule
 * d'abonnement et bannière de la page fournisseur.
 * `banner_storage_object_id` figure dans `STORAGE_REFERENCES`.
 */
export default class extends BaseSchema {
  protected tableName = 'organizations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('vat_verified_at').nullable()
      table.timestamp('domain_verified_at').nullable()
      table.string('locale', 5).notNullable().defaultTo('fr')
      table
        .enum('subscription_plan', [...SUBSCRIPTION_PLANS])
        .notNullable()
        .defaultTo(SUBSCRIPTION_PLANS[0])
      table
        .integer('banner_storage_object_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('storage_objects')
        .onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('banner_storage_object_id')
      table.dropColumn('subscription_plan')
      table.dropColumn('locale')
      table.dropColumn('domain_verified_at')
      table.dropColumn('vat_verified_at')
    })
  }
}
