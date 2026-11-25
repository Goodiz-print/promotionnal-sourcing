import { inject } from '@adonisjs/core'
import AgencyReplyService from '#services/agency_reply_service'
import type AgencyMailRefused from '#events/agency_mail_refused'

/** Un mail de l'agence a été écarté (#226) : ses responsables en sont prévenus. */
@inject()
export default class OnAgencyMailRefused {
  constructor(private agencyReplies: AgencyReplyService) {}

  async handle({ mail }: AgencyMailRefused) {
    await this.agencyReplies.refuse(mail.inboundMailId)
  }
}
