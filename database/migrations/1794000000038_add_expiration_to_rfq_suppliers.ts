import { BaseSchema } from '@adonisjs/lucid/schema'

const CONSTRAINT = 'rfq_suppliers_status_check'

// Listes figées : une migration décrit le schéma tel qu'à sa date, pas tel que
// l'application le voit aujourd'hui.
const STATUSES_BEFORE = ['pending', 'sent', 'viewed', 'responded', 'declined']
const STATUSES_AFTER = [...STATUSES_BEFORE, 'expired']

function checkOn(statuses: readonly string[]) {
  return `CHECK (status IN (${statuses.map((s) => `'${s}'`).join(', ')}))`
}

/**
 * Relance et expiration adaptées au parcours par mail (#232).
 *
 * - `rfq_suppliers.status` gagne `expired` : le destinataire resté sans réponse
 *   à l'échéance (`table.enu()` = varchar + CHECK sous Postgres, d'où le SQL
 *   brut, comme `…950000000_alter_rfqs_add_expiration_and_reminders`) ;
 * - `rfq_suppliers.expired_from` : statut (`sent` / `viewed`) qu'avait le
 *   destinataire avant l'expiration, rendu si l'agence prolonge l'échéance ;
 * - `rfq_suppliers.late_reply_at` : date de la première réponse reçue après
 *   l'échéance (« réponse tardive »).
 */
export default class extends BaseSchema {
  protected tableName = 'rfq_suppliers'

  async up() {
    this.schema.raw(`ALTER TABLE ${this.tableName} DROP CONSTRAINT IF EXISTS ${CONSTRAINT}`)
    this.schema.raw(
      `ALTER TABLE ${this.tableName} ADD CONSTRAINT ${CONSTRAINT} ${checkOn(STATUSES_AFTER)}`
    )

    this.schema.alterTable(this.tableName, (table) => {
      table.string('expired_from', 16).nullable()
      table.timestamp('late_reply_at').nullable()
    })
  }

  async down() {
    // Un destinataire expiré retrouve le statut qu'il avait avant l'échéance.
    this.schema.raw(
      `UPDATE ${this.tableName} SET status = COALESCE(expired_from, 'sent') WHERE status = 'expired'`
    )
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('late_reply_at')
      table.dropColumn('expired_from')
    })

    this.schema.raw(`ALTER TABLE ${this.tableName} DROP CONSTRAINT IF EXISTS ${CONSTRAINT}`)
    this.schema.raw(
      `ALTER TABLE ${this.tableName} ADD CONSTRAINT ${CONSTRAINT} ${checkOn(STATUSES_BEFORE)}`
    )
  }
}
