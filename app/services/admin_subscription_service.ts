import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AdminAuditService from '#services/admin_audit_service'
import ManualSubscriptionService from '#services/manual_subscription_service'
import SubscriptionMailService from '#services/subscription_mail_service'
import type OrganizationSubscription from '#models/organization_subscription'
import { SubscriptionNotEditableException } from '#exceptions/subscription_errors'
import type {
  AdminActionContext,
  AdminAuditAction,
  AdminAuditEntry,
} from '#shared/types/admin_audit'
import type {
  ManualSubscriptionExtension,
  ManualSubscriptionInput,
  ManualSubscriptionTarget,
} from '#shared/types/subscription'

/** Action admin sur un abonnement existant : la cible, la trace et l'auteur. */
interface ChangeOptions {
  target: ManualSubscriptionTarget
  action: AdminAuditAction
  context: AdminActionContext
}

/**
 * Abonnements manuels saisis depuis la fiche admin d'une organisation (#214).
 * Chaque action est tracée dans le journal d'audit **dans la même transaction**.
 */
@inject()
export default class AdminSubscriptionService {
  constructor(
    private manual: ManualSubscriptionService,
    private audit: AdminAuditService,
    private mails: SubscriptionMailService
  ) {}

  /**
   * Crée l'abonnement et le trace. Actif tout de suite, il est annoncé au
   * fournisseur **après** le commit (#237) ; programmé, le job l'annoncera à son
   * activation.
   */
  async create(input: ManualSubscriptionInput, context: AdminActionContext) {
    const subscription = await db.transaction(async (trx) => {
      const created = await this.manual.create(input, trx)
      await this.audit.record(auditEntry('subscription.created', created), {
        ...context,
        client: trx,
      })
      return created
    })
    if (subscription.status === 'active') await this.mails.notifyActivations()
    return subscription
  }

  extend(extension: ManualSubscriptionExtension, context: AdminActionContext) {
    return this.change({ target: extension, action: 'subscription.extended', context }, (trx) =>
      this.manual.extend(extension.subscriptionId, extension.endsOn, trx)
    )
  }

  cancel(target: ManualSubscriptionTarget, context: AdminActionContext) {
    return this.change({ target, action: 'subscription.cancelled', context }, (trx) =>
      this.manual.cancel(target.subscriptionId, trx)
    )
  }

  /**
   * Vérifie que l'abonnement appartient à l'organisation de l'URL, applique
   * l'action et la trace, dans une seule transaction.
   */
  private change(
    { target, action, context }: ChangeOptions,
    run: (trx: TransactionClientContract) => Promise<OrganizationSubscription>
  ) {
    return db.transaction(async (trx) => {
      const owned = await trx
        .from('organization_subscriptions')
        .where('id', target.subscriptionId)
        .where('organization_id', target.organizationId)
        .select('id')
        .first()
      if (!owned) throw new SubscriptionNotEditableException()

      const subscription = await run(trx)
      await this.audit.record(auditEntry(action, subscription), { ...context, client: trx })
      return subscription
    })
  }
}

function auditEntry(
  action: AdminAuditAction,
  subscription: OrganizationSubscription
): AdminAuditEntry {
  return {
    action,
    targetType: 'organization',
    targetId: subscription.organizationId,
    changes: {
      after: {
        subscriptionId: subscription.id,
        plan: subscription.plan,
        status: subscription.status,
        startsAt: subscription.startsAt.toISO(),
        endsAt: subscription.endsAt?.toISO() ?? null,
      },
    },
  }
}
