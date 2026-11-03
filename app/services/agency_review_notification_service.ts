import logger from '@adonisjs/core/services/logger'
import OrganizationUser from '#models/organization_user'
import SendMailJob from '#jobs/send_mail_job'
import { mailIdempotencyKey } from '#shared/helpers/mail'
import { MAIL_KINDS, type SendMailPayload } from '#shared/types/mail'
import type AgencyReviewDecisionRecord from '#models/agency_review_decision'
import type Organization from '#models/organization'
import type { Locale } from '#shared/types/i18n'

/**
 * Prévient les propriétaires d'une agence de la décision prise sur son
 * inscription (#162). Un mail par propriétaire, dans sa langue (`users.locale`),
 * mis en queue (`SendMailJob`). Séparé de `AdminAgencyReviewService` pour que la
 * décision reste testable sans queue.
 */
export default class AgencyReviewNotificationService {
  /**
   * Met en queue un mail par propriétaire. Un échec de mise en queue est loggué
   * sans être propagé : la décision est enregistrée, la file reste la référence.
   * Renvoie le nombre de mails mis en queue.
   */
  async notifyDecision(
    organization: Organization,
    decision: AgencyReviewDecisionRecord
  ): Promise<number> {
    const owners = await OrganizationUser.query()
      .where('organizationId', organization.id)
      .whereHas('role', (role) => role.where('slug', 'owner'))
      .preload('user')

    let queued = 0
    for (const { user } of new Map(owners.map((row) => [row.user.email, row])).values()) {
      try {
        await SendMailJob.dispatch({
          kind: MAIL_KINDS.agencyReviewDecision,
          idempotencyKey: mailIdempotencyKey(MAIL_KINDS.agencyReviewDecision, {
            decision: decision.id,
            to: user.email,
          }),
          to: user.email,
          locale: user.locale as Locale,
          data: {
            organizationName: organization.name,
            decision: decision.decision,
            reason: decision.reason,
          },
        } as SendMailPayload)
        queued += 1
      } catch (error) {
        logger.warn(
          { err: error, organizationId: organization.id },
          'failed to queue agency review notification'
        )
      }
    }
    return queued
  }
}
