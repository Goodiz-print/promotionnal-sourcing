import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Équipe commerciale des fournisseurs (#241).
 *
 * - `supplier_contacts.countries` : pays couverts (codes ISO alpha-2). Une
 *   liste vide signifie « tous les pays ». Remplace le texte libre `coverage`,
 *   qu'aucun écran n'a jamais écrit.
 * - `supplier_contacts.user_id` : lien facultatif vers un membre du compte
 *   fournisseur (le commercial se connecte aussi). La clé étrangère est
 *   **composite**, vers l'adhésion `organization_users (organization_id, user_id)` :
 *   la base refuse de relier un non-membre, et un départ par n'importe quel
 *   chemin (retrait, départ volontaire, back-office, suppression du compte)
 *   délie le contact (`SET NULL (user_id)`, PostgreSQL ≥ 15) sans le supprimer.
 * - `supplier_profiles.show_all_contacts` : « montrer toute l'équipe à toutes
 *   les agences », désactivé par défaut.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('supplier_contacts', (table) => {
      table.specificType('countries', 'text[]').notNullable().defaultTo('{}')
      table.integer('user_id').unsigned().nullable()
      table.dropColumn('coverage')
      table.index(['organization_id', 'position'])
    })
    this.schema.raw(
      `ALTER TABLE supplier_contacts ADD CONSTRAINT supplier_contacts_member_foreign
         FOREIGN KEY (organization_id, user_id)
         REFERENCES organization_users (organization_id, user_id)
         ON DELETE SET NULL (user_id)`
    )

    this.schema.alterTable('supplier_profiles', (table) => {
      table.boolean('show_all_contacts').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable('supplier_profiles', (table) => {
      table.dropColumn('show_all_contacts')
    })

    this.schema.raw(
      'ALTER TABLE supplier_contacts DROP CONSTRAINT IF EXISTS supplier_contacts_member_foreign'
    )
    this.schema.alterTable('supplier_contacts', (table) => {
      table.dropIndex(['organization_id', 'position'])
      table.string('coverage', 255).nullable()
      table.dropColumn('user_id')
      table.dropColumn('countries')
    })
  }
}
