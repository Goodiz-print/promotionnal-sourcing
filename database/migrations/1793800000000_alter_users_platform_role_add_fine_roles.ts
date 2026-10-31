import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Rôles plateforme fins (#158) : `moderator`, `support` et `analyst` s'ajoutent
 * à `none` et `admin`. Knex crée un `enum` PostgreSQL sous forme de contrainte
 * `CHECK` : on la remplace. Les valeurs sont écrites en dur (et non importées de
 * `shared/types/user`) pour qu'une migration reste figée dans le temps.
 */
export default class extends BaseSchema {
  protected tableName = 'users'
  private constraint = 'users_platform_role_check'

  async up() {
    this.schema.raw(`ALTER TABLE ${this.tableName} DROP CONSTRAINT IF EXISTS ${this.constraint}`)
    this.schema.raw(
      `ALTER TABLE ${this.tableName} ADD CONSTRAINT ${this.constraint} ` +
        `CHECK (platform_role IN ('none', 'admin', 'moderator', 'support', 'analyst'))`
    )
  }

  async down() {
    // Les rôles fins n'existent plus : leurs porteurs perdent l'accès au back-office.
    this.schema.raw(
      `UPDATE ${this.tableName} SET platform_role = 'none' ` +
        `WHERE platform_role NOT IN ('none', 'admin')`
    )
    this.schema.raw(`ALTER TABLE ${this.tableName} DROP CONSTRAINT IF EXISTS ${this.constraint}`)
    this.schema.raw(
      `ALTER TABLE ${this.tableName} ADD CONSTRAINT ${this.constraint} ` +
        `CHECK (platform_role IN ('none', 'admin'))`
    )
  }
}
