import { inject } from '@adonisjs/core'
import Organization from '#models/organization'
import InAppNotificationService from '#services/in_app_notification_service'
import type RfqDeclined from '#events/rfq_declined'

/** Un fournisseur a décliné : les responsables de l'acheteur en sont prévenus. */
@inject()
export default class OnRfqDeclined {
  constructor(private inApp: InAppNotificationService) {}

  async handle({ rfq, supplierOrganizationId }: RfqDeclined) {
    const supplier = await Organization.findOrFail(supplierOrganizationId)
    await this.inApp.rfqDeclined(rfq, supplier)
  }
}
