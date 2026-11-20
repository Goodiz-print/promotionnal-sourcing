import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Équipe commerciale des fournisseurs (#241).
 *
 * - `supplier_contacts.countries` : pays couverts (codes ISO alpha-2). Une
 *   liste vide signifie « tous les pays ». Remplace le texte libre `coverage`,
 *   qu'aucun écran n'a jamais écrit.
 * - `supplier_contacts.user_id` : lien facultatif vers un membre du compte
 *   fournisseur (le commercial se connecte aussi). `SET NULL` à la suppression
 *   de l'utilisateur : la fiche de contact reste.
 * - `supplier_profiles.show_all_contacts` : « montrer toute l'équipe à toutes
 *   les agences », désactivé par défaut.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('supplier_contacts', (table) => {
      table.specificType('countries', 'text[]').notNullable().defaultTo('{}')
      table
        .integer('user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.dropColumn('coverage')
      table.index(['organization_id', 'position'])
    })

    this.schema.alterTable('supplier_profiles', (table) => {
      table.boolean('show_all_contacts').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable('supplier_profiles', (table) => {
      table.dropColumn('show_all_contacts')
    })

    this.schema.alterTable('supplier_contacts', (table) => {
      table.dropIndex(['organization_id', 'position'])
      table.string('coverage', 255).nullable()
      table.dropForeign(['user_id'])
      table.dropColumn('user_id')
      table.dropColumn('countries')
    })
  }
}
