import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('email_verified_at').nullable()
    })

    // Les comptes existants ont été créés avant la vérification d'email :
    // on les considère vérifiés, sinon le déploiement bloquerait tous les
    // utilisateurs actuels derrière l'écran « vérifiez votre email ».
    this.defer(async (db) => {
      await db.from(this.tableName).whereNull('email_verified_at').update({
        email_verified_at: new Date(),
      })
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('email_verified_at')
    })
  }
}
