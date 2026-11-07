import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Index de la supervision des emails (#178) : la liste est triée sur `updated_at`
 * et l'aperçu des taux d'échec filtre sur `created_at`. Les lignes `sent` sont
 * conservées : sans index, ces deux écrans balayeraient une table qui ne fait que grossir.
 */
export default class extends BaseSchema {
  protected tableName = 'mail_deliveries'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['updated_at'], 'mail_deliveries_updated_at_idx')
      table.index(['created_at', 'kind'], 'mail_deliveries_created_at_kind_idx')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['created_at', 'kind'], 'mail_deliveries_created_at_kind_idx')
      table.dropIndex(['updated_at'], 'mail_deliveries_updated_at_idx')
    })
  }
}
