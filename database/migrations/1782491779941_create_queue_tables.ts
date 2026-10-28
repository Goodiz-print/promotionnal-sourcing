import { BaseSchema } from '@adonisjs/lucid/schema'
import { KnexQueueSchemaService } from '@boringnode/queue/drivers/knex_adapter'

/**
 * Créée avec `QueueSchemaService` de @adonisjs/queue 0.6, retiré en 0.7.
 * Une migration exécutée ne se rejoue pas : sur les bases existantes, les
 * tables 0.6 sont mises à niveau par `node ace queue:migrate`. Sur une base
 * neuve, cette migration crée directement le schéma de @boringnode/queue 0.9.
 */
export default class extends BaseSchema {
  async up() {
    const schemaService = new KnexQueueSchemaService(this.db.getWriteClient())

    await schemaService.createJobsTable()
    await schemaService.createSchedulesTable()
  }

  async down() {
    const schemaService = new KnexQueueSchemaService(this.db.getWriteClient())

    await schemaService.dropSchedulesTable()
    await schemaService.dropJobsTable()
  }
}
