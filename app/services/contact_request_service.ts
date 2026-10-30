import SendMailJob from '#jobs/send_mail_job'
import { mailSendKey } from '#shared/helpers/mail'
import type { Locale } from '#shared/types/i18n'
import { MAIL_KINDS, type ContactRequestMailData } from '#shared/types/mail'
import { CONTACT_EMAIL, PARTNERS_EMAIL, type ContactRequestType } from '#shared/types/marketing'

export type ContactRequestInput = Omit<ContactRequestMailData, 'phone' | 'requesterLocale'> & {
  phone?: string
}

const RECIPIENTS: Record<ContactRequestType, string> = {
  contact: CONTACT_EMAIL,
  partnership: PARTNERS_EMAIL,
}

/**
 * Formulaire de contact de la landing : la demande est transmise à l'équipe par
 * la queue de mails (reprise sur erreur, dead-letter), contact@ ou partners@
 * selon le type de demande.
 */
export default class ContactRequestService {
  async submit(input: ContactRequestInput, requesterLocale: Locale): Promise<void> {
    await SendMailJob.dispatch({
      kind: MAIL_KINDS.contactRequest,
      idempotencyKey: mailSendKey(MAIL_KINDS.contactRequest, { company: input.company }),
      to: RECIPIENTS[input.type],
      // Mail interne : l'équipe lit en français, quelle que soit la langue du visiteur.
      locale: 'fr',
      data: { ...input, phone: input.phone || null, requesterLocale },
    })
  }
}
