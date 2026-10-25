import { inject } from '@adonisjs/core'
import InAppNotificationService from '#services/in_app_notification_service'
import type MemberJoined from '#events/member_joined'

/** Un nouveau membre a rejoint l'organisation : ses propriétaires et administrateurs le voient. */
@inject()
export default class OnMemberJoined {
  constructor(private inApp: InAppNotificationService) {}

  async handle({ organization, user }: MemberJoined) {
    await this.inApp.memberJoined(organization, user)
  }
}
