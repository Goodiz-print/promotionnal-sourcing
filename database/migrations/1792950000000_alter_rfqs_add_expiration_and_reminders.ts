import { BaseSchema } from '@adonisjs/lucid/schema'
import { RFQ_STATUSES } from '#shared/types/rfq'

const CONSTRAINT = 'rfqs_status_check'

function checkOn(statuses: readonly string[]) {
  return `CHECK (status IN (${statuses.map((s) => `'${s}'`).join(', ')}))`
}

/**
 * Expiration et relance des demandes de devis (#56).
 *
 * - `rfqs.status` gagne `expired` : `table.enu()` produit sous Postgres une
 *   colonne varchar + une contrainte CHECK, d'où le SQL brut pour l'étendre
 *   (même démarche que `…967_alter_organization_invitations_add_expired_status`) ;
 * - `rfqs.expired_at` : date de la bascule (remise à `NULL` si l'acheteur
 *   prolonge l'échéance et rouvre la demande) ;
 * - `rfq_suppliers.reminded_at` : date de l'unique relance d'un destinataire
 *   silencieux — `NULL` tant qu'il n'a pas été relancé.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`ALTER TABLE rfqs DROP CONSTRAINT IF EXISTS ${CONSTRAINT}`)
    this.schema.raw(`ALTER TABLE rfqs ADD CONSTRAINT ${CONSTRAINT} ${checkOn(RFQ_STATUSES)}`)

    this.schema.alterTable('rfqs', (table) => {
      table.timestamp('expired_at').nullable()
    })
    this.schema.alterTable('rfq_suppliers', (table) => {
      table.timestamp('reminded_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable('rfq_suppliers', (table) => {
      table.dropColumn('reminded_at')
    })
    this.schema.alterTable('rfqs', (table) => {
      table.dropColumn('expired_at')
    })

    // Les demandes échues redeviennent publiées (leur état d'avant : échéance
    // dépassée de fait, mais jamais basculée).
    this.schema.raw(`UPDATE rfqs SET status = 'published' WHERE status = 'expired'`)
    this.schema.raw(`ALTER TABLE rfqs DROP CONSTRAINT IF EXISTS ${CONSTRAINT}`)
    this.schema.raw(
      `ALTER TABLE rfqs ADD CONSTRAINT ${CONSTRAINT} ${checkOn(
        RFQ_STATUSES.filter((status) => status !== 'expired')
      )}`
    )
  }
}
