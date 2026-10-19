import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Registre des envois de mails transactionnels (#59) : idempotence (une clé =
 * un mail effectivement envoyé) et dead-letter (`failed` = à rejouer avec
 * `node ace mail:retry`).
 *
 * `payload` conserve la charge tant que le mail n'est pas parti, pour pouvoir le
 * rejouer ; il est vidé à l'envoi (il peut contenir des URL signées).
 */
export default class extends BaseSchema {
  protected tableName = 'mail_deliveries'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('idempotency_key', 255).notNullable().unique()
      table.string('kind', 50).notNullable()
      table.string('to', 255).notNullable()
      table.string('status', 10).notNullable().defaultTo('failed')
      table.timestamp('sent_at', { useTz: true }).nullable()
      table.text('error').nullable()
      table.integer('attempts').unsigned().notNullable().defaultTo(0)
      table.jsonb('payload').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
    this.schema.raw(
      `ALTER TABLE ${this.tableName} ADD CONSTRAINT mail_deliveries_status_check CHECK (status IN ('sent', 'failed'))`
    )
    this.schema.raw(
      `CREATE INDEX mail_deliveries_failed_idx ON ${this.tableName} (status) WHERE status = 'failed'`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
