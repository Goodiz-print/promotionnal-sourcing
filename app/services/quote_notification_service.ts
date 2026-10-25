import { urlFor } from '@adonisjs/core/services/url_builder'
import logger from '@adonisjs/core/services/logger'
import OrganizationUser from '#models/organization_user'
import SendMailJob from '#jobs/send_mail_job'
import { mailIdempotencyKey } from '#shared/helpers/mail'
import { MAIL_KINDS, type SendMailPayload } from '#shared/types/mail'
import { RFQ_MANAGER_ROLES } from '#shared/types/rfq'
import type Quote from '#models/quote'
import type { Locale } from '#shared/types/i18n'

/**
 * Prévient l'acheteur qu'un devis vient d'être remis (listener de
 * `QuoteSubmitted`). Séparé de `QuoteService` pour la même raison que
 * `RfqNotificationService` : la machine à états reste testable sans queue.
 *
 * Destinataires : les membres de l'organisation acheteuse qui peuvent décider
 * (`RFQ_MANAGER_ROLES`, comme `canManageRfq`) — un `member`, qui ne peut ni
 * accepter ni rejeter, n'a rien à faire de ce mail. Chacun est écrit dans sa
 * langue (`users.locale`).
 */
export default class QuoteNotificationService {
  /**
   * Met en queue un mail par responsable. Un échec de mise en queue est loggué
   * sans être propagé : le devis est remis, et visible sur l'écran de la
   * demande de toute façon. Suppose `quote.rfq` et `quote.supplierOrganization`
   * préchargés. Renvoie le nombre de mails mis en queue.
   */
  async notifySubmitted(quote: Quote): Promise<number> {
    const memberships = await OrganizationUser.query()
      .where('organizationId', quote.rfq.buyerOrganizationId)
      .whereHas('role', (role) => role.whereIn('slug', [...RFQ_MANAGER_ROLES]))
      .preload('user')

    let queued = 0
    for (const { user } of new Map(memberships.map((row) => [row.user.email, row])).values()) {
      const locale = user.locale as Locale
      try {
        await SendMailJob.dispatch({
          kind: MAIL_KINDS.quoteReceived,
          idempotencyKey: mailIdempotencyKey(MAIL_KINDS.quoteReceived, {
            quote: quote.id,
            to: user.email,
          }),
          to: user.email,
          locale,
          data: {
            supplierName: quote.supplierOrganization.name,
            rfqTitle: quote.rfq.title,
            total: this.formatAmount(Number(quote.totalAmount), quote.currency, locale),
            quotePath: urlFor('quotes.show', { locale, id: quote.id }),
          },
        } as SendMailPayload)
        queued += 1
      } catch (error) {
        logger.warn({ err: error, quoteId: quote.id }, 'failed to queue quote notification')
      }
    }
    return queued
  }

  private formatAmount(amount: number, currency: string, locale: Locale): string {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
  }
}
