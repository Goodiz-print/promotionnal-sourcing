import { DateTime } from 'luxon'
import factory from '@adonisjs/lucid/factories'
import RfqSupplier from '#models/rfq_supplier'

/**
 * Destinataire d'une demande de devis, `pending` par défaut (pas encore
 * notifié). `rfqId` et `supplierOrganizationId` restent à fournir par l'appelant.
 */
export const RfqSupplierFactory = factory
  .define(RfqSupplier, async () => ({
    status: 'pending' as const,
  }))
  .state('sent', (recipient) => {
    recipient.status = 'sent'
    recipient.sentAt = DateTime.now()
  })
  .build()
