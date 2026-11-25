import { BaseSchema } from '@adonisjs/lucid/schema'
import { SUBSCRIPTION_STATUSES } from '#shared/types/subscription'

/**
 * Abonnements des organisations (#214, #215) : une ligne par période souscrite,
 * conservée après expiration ou résiliation (historique). `organizations.subscription_plan`
 * reste la formule courante dénormalisée, écrite uniquement par `SubscriptionService`.
 *
 * - `origin` est une chaîne libre (`manual`, `stripe`…) validée côté application :
 *   une nouvelle origine ne demande pas de migration de structure.
 * - `stripe_subscription_id` (unique) relie la ligne à l'abonnement Stripe : un
 *   webhook rejoué met à jour la même ligne, il n'en crée jamais une seconde.
 * - Index unique partiel : **un seul** abonnement en cours (`active` ou
 *   `past_due`) par organisation.
 */
export default class extends BaseSchema {
  protected tableName = 'organization_subscriptions'

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
      table.string('plan', 20).notNullable()
      table.enum('status', [...SUBSCRIPTION_STATUSES]).notNullable()
      table.string('origin', 20).notNullable()
      table.timestamp('starts_at').notNullable()
      table.timestamp('ends_at').nullable()
      table.boolean('cancel_at_period_end').notNullable().defaultTo(false)
      table.timestamp('cancelled_at').nullable()
      table.string('stripe_subscription_id', 100).nullable().unique()
      table.string('stripe_status', 30).nullable()
      table
        .integer('created_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['organization_id', 'created_at'])
    })

    this.schema.raw(
      `ALTER TABLE ${this.tableName} ADD CONSTRAINT organization_subscriptions_plan_check ` +
        `CHECK (plan IN ('business', 'premium'))`
    )
    this.schema.raw(
      `CREATE UNIQUE INDEX organization_subscriptions_one_current_idx ON ${this.tableName} ` +
        `(organization_id) WHERE status IN ('active', 'past_due')`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
