import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * État de chaque composant sondé par le job de surveillance (#179) : une ligne par
 * composant, mise à jour à chaque passe. Elle alimente le tableau de bord (sans
 * sonder) et dit si une alerte a déjà été envoyée pour l'incident en cours.
 */
export default class extends BaseSchema {
  protected tableName = 'health_component_states'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.string('component', 32).primary()
      table.string('status', 16).notNullable()
      table.integer('consecutive_failures').notNullable().defaultTo(0)
      table.timestamp('since', { useTz: true }).notNullable()
      table.timestamp('checked_at', { useTz: true }).notNullable()
      table.text('detail').nullable()
      table.boolean('alerted').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
