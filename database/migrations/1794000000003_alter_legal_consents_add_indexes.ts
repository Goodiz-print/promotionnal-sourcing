import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Journal des consentements (#168) : l'écran d'administration trie par date de
 * signature et filtre par version. Index ajoutés pour que la liste reste
 * rapide quand le journal grossit.
 */
export default class extends BaseSchema {
  protected tableName = 'legal_consents'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['accepted_at'])
      table.index(['version'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['accepted_at'])
      table.dropIndex(['version'])
    })
  }
}
