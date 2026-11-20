import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Abonnement manuel saisi par l'admin (#214) : **un seul** abonnement programmé
 * (`scheduled`) à la fois par organisation, en plus de l'index existant sur
 * l'abonnement en cours. Deux périodes programmées pourraient se chevaucher et
 * s'activer ensemble ; la seconde se saisit une fois la première activée
 * (prolongation) ou résiliée.
 */
export default class extends BaseSchema {
  protected tableName = 'organization_subscriptions'

  async up() {
    this.schema.raw(
      `CREATE UNIQUE INDEX organization_subscriptions_one_scheduled_idx ON ${this.tableName} ` +
        `(organization_id) WHERE status = 'scheduled'`
    )
  }

  async down() {
    this.schema.raw('DROP INDEX IF EXISTS organization_subscriptions_one_scheduled_idx')
  }
}
