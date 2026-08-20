import { BaseSchema } from '@adonisjs/lucid/schema'
import { INVITATION_STATUSES } from '#shared/types/organization'

const CONSTRAINT = 'organization_invitations_status_check'

function checkOn(statuses: readonly string[]) {
  return `CHECK (status IN (${statuses.map((s) => `'${s}'`).join(', ')}))`
}

/**
 * Ajoute le statut `expired` aux invitations : le job de purge
 * (`PurgeExpiredInvitationsJob`) bascule les invitations en attente dont
 * `expires_at` est dépassé, qui restaient sinon `pending` indéfiniment.
 *
 * `table.enu()` produit sous Postgres une colonne varchar + une contrainte
 * CHECK — d'où le SQL brut (knex n'expose pas d'API pour étendre l'énumération
 * d'une colonne existante). Les migrations du projet sont déjà Postgres-only
 * (cf. `enable_search_extensions`).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`ALTER TABLE organization_invitations DROP CONSTRAINT IF EXISTS ${CONSTRAINT}`)
    this.schema.raw(
      `ALTER TABLE organization_invitations ADD CONSTRAINT ${CONSTRAINT} ${checkOn(INVITATION_STATUSES)}`
    )
  }

  async down() {
    // Les invitations basculées par la purge redeviennent `pending` (leur état
    // d'avant la migration : expirées de fait, via `expires_at`).
    this.schema.raw(
      `UPDATE organization_invitations SET status = 'pending' WHERE status = 'expired'`
    )
    this.schema.raw(`ALTER TABLE organization_invitations DROP CONSTRAINT IF EXISTS ${CONSTRAINT}`)
    this.schema.raw(
      `ALTER TABLE organization_invitations ADD CONSTRAINT ${CONSTRAINT} ${checkOn(
        INVITATION_STATUSES.filter((s) => s !== 'expired')
      )}`
    )
  }
}
